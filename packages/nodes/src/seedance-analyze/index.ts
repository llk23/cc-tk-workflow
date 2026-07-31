import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, VideoAnalysis } from '@tk-workflow/types';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 即梦 Seedance 2.0 视频分析节点
 *
 * 加载 seedance-2.0-main 技能（SKILL.md）作为 AI 模型的核心知识，
 * 分析 TikTok 视频 → 输出结构化分析 + 符合 Seedance 2.0 语法的复刻提示词
 *
 * 流程：yt-dlp 下载 → Ark Files API 上传完整视频（失败则 ffmpeg 抽帧）→ AI 多模态分析 → JSON 输出
 */
export class SeedanceAnalyzeNode extends BaseNode {
  static definition: NodeDefinition = {
    type: 'ai-analyze-seedance' as any,
    label: '视频分析（即梦Seedance2.0直用）',
    description: '加载 Seedance 2.0 技能指南，分析视频并输出符合 SD2.0 语法的复刻提示词',
    category: 'ai',
    icon: '🎯',
    inputs: [{ id: 'videos', name: '视频数据', type: 'video', required: true }],
    outputs: [{ id: 'analysis', name: '分析结果', type: 'analysis', required: true }],
    defaultConfig: {
      analysisMode: 'video',
      customPrompt: '',
    },
  };

  private skillContent: string | null = null;

  /** 加载 Seedance 2.0 技能文件（项目内 seedance-2.0-main） */
  private loadSkill(): string {
    if (this.skillContent) return this.skillContent;

    const candidates = [
      path.join(process.cwd(), '.claude', 'skills', 'seedance-2.0-main', 'SKILL.md'),
      path.join(__dirname, '..', '..', '..', '..', '.claude', 'skills', 'seedance-2.0-main', 'SKILL.md'),
    ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.skillContent = fs.readFileSync(p, 'utf-8');
          return this.skillContent;
        }
      } catch {
        // 忽略路径读取异常
      }
    }

    this.skillContent = '';
    return '';
  }

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const inputObj = (input || {}) as any;
    const videos = inputObj.videos ?? [];

    // ---- 模型配置来源优先级：上游 ModelConfig 节点 > 输入合并 > 环境变量 ----
    let apiBaseUrl: string;
    let apiKey: string;
    let model: string;
    let configSource: string;

    const upstreamModelConfig = inputObj.modelConfig;
    if (upstreamModelConfig?.apiBaseUrl && upstreamModelConfig?.apiKey && upstreamModelConfig?.model) {
      apiBaseUrl = upstreamModelConfig.apiBaseUrl;
      apiKey = upstreamModelConfig.apiKey;
      model = upstreamModelConfig.model;
      configSource = '上游模型配置节点';
    } else if (inputObj.apiBaseUrl && inputObj.apiKey && inputObj.model) {
      apiBaseUrl = inputObj.apiBaseUrl;
      apiKey = inputObj.apiKey;
      model = inputObj.model;
      configSource = '上游模型配置节点(合并)';
    } else {
      apiKey = process.env.OPENAI_API_KEY || '';
      apiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      model = process.env.OPENAI_MODEL || 'gpt-4o';
      configSource = apiKey ? '环境变量' : '无配置';
    }

    if (!apiKey) {
      ctx.logger('⚠️ 未配置 API Key');
      return { analyses: [], configSource: '无配置', error: '缺少 API Key' };
    }

    const cfg = config as any;
    const customPrompt = cfg.customPrompt || '';

    const skill = this.loadSkill();
    if (skill) {
      ctx.logger(`  ✅ 已加载 Seedance 2.0 技能指南 (${skill.length} 字符)`);
    }

    ctx.logger(`[即梦SD2.0] 模型=${model} 来源=${configSource} 共 ${videos.length} 个视频`);

    if (!videos.length) {
      ctx.logger('警告：没有收到视频数据');
      return { analyses: [], analysisMode: 'video' };
    }

    const systemPrompt = this.buildSystemPrompt(skill, customPrompt);
    const analyses: VideoAnalysis[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      ctx.onProgress(Math.round(((i + 1) / videos.length) * 100));
      ctx.logger(`分析 ${i + 1}/${videos.length}: ${video.id}`);

      try {
        const result = await this.analyzeSingle(video, apiBaseUrl, apiKey, model, systemPrompt, ctx);
        // 合并视频元数据到分析结果
        analyses.push({
          ...result,
          author: video.author || '',
          description: video.description || '',
          plays: video.plays ?? 0,
          likes: video.likes ?? 0,
          comments: video.comments ?? 0,
          duration: video.duration ?? 0,
          coverUrl: video.coverUrl || '',
          isCommerce: !!video.isCommerce,
        });
      } catch (e: any) {
        ctx.logger(`⚠️ ${video.id} 失败：${e.message}`);
        analyses.push({
          videoId: video.id,
          styleCategory: '',
          suggestions: ['失败: ' + e.message],
          generatedTags: [],
          analyzedAt: new Date().toISOString(),
          error: e.message,
        } as any);
      }
    }

    ctx.onProgress(100);
    ctx.logger(`完成：成功 ${analyses.filter((a: any) => !a.error).length}/${analyses.length}`);

    return {
      analyses,
      analysisMode: 'video',
      configSource,
      modelUsed: model,
      seedanceSkillLoaded: !!skill,
      total: analyses.length,
    };
  }

  /**
   * ════════════════════════════════════════════════════════════════
   *  位置 A：约束 AI 输出格式（修改这里 = 改 AI 给你的结果内容）
   * ════════════════════════════════════════════════════════════════
   *
   *  当前要求 AI 输出：技术参数 + 时间轴拆解 + 核心卖点 + 复刻提示词
   *  你可以在下面自由增删输出要求，比如加"目标受众分析"、"竞品对比"等。
   */
  private buildSystemPrompt(skill: string, customPrompt: string): string {
    return `你是即梦 Seedance 2.0 专业提示词工程师。分析这个视频，输出完整的视频分析报告 + 可直接在 Seedance 2.0 中使用的复刻提示词。

## 工作指南
${skill || ''}

## 输出要求
### 第一部分：视频分析报告
逐项详细输出以下内容，每一项都要写完整：

**1. 基本信息**
- 文件名（如有）、时长（精确到 0.1 秒）、分辨率、画面比例
- 帧率、音轨编码格式（如 AAC、MP3）及声道
- 是否有水印/字幕/品牌标识，位置与内容
- 视频类型（产品展示 / 生活Vlog / 带货种草 / 教程 / 其他）

**2. 帧级时间轴分镜拆解**
按时间精确到秒分段，每段分别说明：
- 画面内容（主体、动作、场景、构图）
- 镜头/运镜（特写/中景/全景、推/拉/摇/移/固定/手持、视角）
- 音效/对白/旁白

**3. 核心卖点提炼**
列出 3-5 条核心卖点或内容亮点，按重要性排序

**4. 视觉风格分析**
- 色调/打光（暖/冷/自然光/棚拍、饱和度、对比度）
- 质感（胶片/数码/电影感/真实UGC/ASMR感、纹理细节）
- 氛围/情绪（治愈/紧张/轻松/高级感/生活化等）
- 剪辑节奏（快/中/慢、切镜频率、转场方式）

### 第二部分：Seedance 2.0 复刻提示词
用 Seedance 2.0 语法写一段可直接复制使用的完整复刻提示词，必须包含：
- @ 引用语法说明（需要哪些参考素材：首帧图、产品参考图、参考视频等）
- 分时段描述（精确到秒）
- 主体、场景、动作、运镜语言、音频设计、风格修饰词
- 生成参数建议（时长、比例）

${customPrompt ? `\n## 额外要求\n${customPrompt}` : ''}

---
注意：你的输出不是 JSON，是一份可直接阅读的分析报告。写详细、写完整。`;
  }

  private async analyzeSingle(
    video: any,
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<any> {
    const { author, id: videoId, duration } = video;
    if (!author || !videoId) throw new Error('缺少视频作者或 ID');

    const pageUrl = `https://www.tiktok.com/@${author}/video/${videoId}`;
    ctx.logger(`  📥 通过 yt-dlp 下载视频...`);

    // ---- 1. 下载视频 ----
    const cacheDir = path.join(process.cwd(), '.cache', 'seedance-videos');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const tmpPath = path.join(cacheDir, `sd2_${videoId}.mp4`);

    try {
      execSync(`yt-dlp --no-warnings -o "${tmpPath}" "${pageUrl}" 2>&1`, { timeout: 120000, stdio: 'pipe' });
    } catch (e: any) {
      if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size === 0) {
        throw new Error(`yt-dlp 下载失败：${e.message || e}`);
      }
    }
    ctx.logger(`  ✅ 下载完成 (${(fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1)}MB)`);

    // ---- 2. 调用 AI 分析（优先上传完整视频，失败则抽帧回退） ----
    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    const chatUrl = baseUrl.match(/\/v\d+\/?$/) ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    let raw: string;

    try {
      raw = await this.analyzeWithFullVideo(tmpPath, videoId, author, duration, apiKey, baseUrl, chatUrl, model, systemPrompt, ctx);
    } catch (upErr: any) {
      ctx.logger(`  ⚠️ 视频上传不可用，回退到抽帧: ${(upErr.message || '').slice(0, 80)}`);
      raw = await this.analyzeWithFrames(tmpPath, videoId, author, duration, apiKey, chatUrl, model, systemPrompt, cacheDir, ctx);
    }

    // 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch {}

    // ---- 3. 返回原始分析报告 ----
    ctx.logger(`  ✅ 分析完成`);
    ctx.logger(`  📄 报告长度: ${raw.length} 字符`);

    /**
     * ════════════════════════════════════════════════════════════════
     *  位置 B：整理 AI 返回的 JSON 映射到最终结果
     * ════════════════════════════════════════════════════════════════
     *
     *  如果位置 A 加了新字段，这里也要对应加上解析逻辑。
     *  格式：字段名: parsed.xxx?.yyy || '默认值',
     *
     *  当前映射表（可以在这里加/删字段）：
     */
    return {
      videoId,
      styleCategory: '',
      captionStructure: '',
      targetAudience: [],
      suggestions: [],
      generatedTags: [],
      rawOutput: raw,
      analyzedAt: new Date().toISOString(),
      modelUsed: model,
    };
  }

  /** 通过 Ark Files API 上传完整视频后分析 */
  private async analyzeWithFullVideo(
    tmpPath: string,
    videoId: string,
    author: string,
    duration: number,
    apiKey: string,
    baseUrl: string,
    chatUrl: string,
    model: string,
    systemPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<string> {
    ctx.logger(`  📤 尝试上传视频到 Ark Files API...`);

    const filesUrl = baseUrl.replace(/\/v\d+$/, '') + '/v3/files';
    const fileBuf = fs.readFileSync(tmpPath);
    const boundary = '----' + Date.now().toString(36);

    const header = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="purpose"\r\n\r\nvision\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="v_' + videoId + '.mp4"\r\n' +
      'Content-Type: video/mp4\r\n\r\n',
      'utf-8',
    );
    const footer = Buffer.from('\r\n--' + boundary + '--\r\n', 'utf-8');

    const upResp = await fetch(filesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
      },
      body: Buffer.concat([header, fileBuf, footer]),
    });

    if (!upResp.ok) {
      const err = await upResp.text();
      throw new Error('上传失败: ' + err.slice(0, 100));
    }

    const upData = await upResp.json();
    const fileId = upData?.data?.id || '';
    ctx.logger(`  ✅ 视频上传成功 (file_id: ${fileId})`);

    const content: any[] = [
      { type: 'text', text: `作者:${author} 时长:${duration}s` },
      { type: 'image_url', image_url: { url: `ark://${fileId}` } },
    ];

    const r = await fetch(chatUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(err.slice(0, 200));
    }

    const d = await r.json();
    return d.choices?.[0]?.message?.content || '{}';
  }

  /** ffmpeg 抽帧回退方案：提取关键帧 → base64 → 多模态分析 */
  private async analyzeWithFrames(
    tmpPath: string,
    videoId: string,
    author: string,
    duration: number,
    apiKey: string,
    chatUrl: string,
    model: string,
    systemPrompt: string,
    cacheDir: string,
    ctx: NodeExecutionContext,
  ): Promise<string> {
    ctx.logger(`  🎞 提取视频帧...`);

    const framesDir = path.join(cacheDir, 'f_' + videoId);
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

    const frameCount = 10;
    const fps = Math.max(1, Math.floor(frameCount / (duration || 30)));

    execSync(
      `ffmpeg -i "${tmpPath}" -vf "fps=${fps}" -q:v 2 -frames:v ${frameCount} "${framesDir}/%02d.jpg" 2>&1`,
      { timeout: 60000, stdio: 'pipe' },
    );

    const frameFiles = fs.readdirSync(framesDir).sort().slice(0, frameCount);
    if (!frameFiles.length) throw new Error('抽帧失败');

    ctx.logger(`  ✅ 提取 ${frameFiles.length} 帧，发送分析...`);

    const content: any[] = [{ type: 'text', text: `作者:${author} 时长:${duration}s` }];
    frameFiles.forEach(f => {
      const base64 = fs.readFileSync(path.join(framesDir, f)).toString('base64');
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } });
    });

    const r = await fetch(chatUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`分析失败 (${r.status}): ${err.slice(0, 200)}`);
    }

    // 清理帧目录
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}

    const d = await r.json();
    return d.choices?.[0]?.message?.content || '{}';
  }
}
