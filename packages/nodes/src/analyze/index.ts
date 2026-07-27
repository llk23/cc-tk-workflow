import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum, VideoAnalysis } from '@tk-workflow/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI 视频分析节点
 *
 * 分析模式：
 *   metadata - 纯文本分析（基于视频描述、播放量、点赞数等元数据，无需下载视频）
 *   video    - 全视频分析（通过 CDP 浏览器加载视频 → 采帧 → 多模态 AI 分析）
 */
export class AIAnalyzeVideoNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.AI_ANALYZE,
    label: 'AI 视频分析',
    description: '分析视频内容（元数据分析 / 全视频分析两种模式）',
    category: 'ai',
    icon: '🧠',
    inputs: [{ id: 'videos', name: '视频数据', type: 'video', required: true }],
    outputs: [{ id: 'analysis', name: '分析结果', type: 'analysis', required: true }],
    defaultConfig: {
      analysisMode: 'metadata',
      customPrompt: '',
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const inputObj = (input || {}) as any;
    const videos = inputObj.videos ?? [];

    // ---- 模型配置 ----
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
      ctx.logger('⚠️ 未配置 API Key。请连接 AI 模型配置节点输出到本节点。');
      return { analyses: [], configSource: '无配置', error: '缺少 API Key' };
    }

    const cfg = config as any;
    const analysisMode = cfg.analysisMode || 'metadata';
    const customPrompt = cfg.customPrompt || '';

    ctx.logger(`[AI分析] 模式=${analysisMode} 模型=${model} 来源=${configSource}`);
    ctx.logger(`[AI分析] 共 ${videos.length} 个视频`);

    if (!videos.length) {
      ctx.logger('警告：没有收到视频数据');
      return { analyses: [], analysisMode };
    }

    // ---- 逐个分析 ----
    const analyses: VideoAnalysis[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const pct = Math.round(((i + 1) / videos.length) * 100);
      ctx.onProgress(pct);

      ctx.logger(`分析视频 ${i + 1}/${videos.length}: ${video.id} (${analysisMode}模式)`);

      try {
        let result: VideoAnalysis;

        if (analysisMode === 'metadata') {
          result = await this.analyzeByMetadata(video, apiBaseUrl, apiKey, model, customPrompt, ctx);
        } else {
          result = await this.analyzeVideo(video, apiBaseUrl, apiKey, model, customPrompt, ctx);
        }

        // 将视频元数据合并到分析结果
        (result as any).author = video.author || '';
        (result as any).description = video.description || '';
        (result as any).plays = video.plays ?? 0;
        (result as any).likes = video.likes ?? 0;
        (result as any).comments = video.comments ?? 0;
        (result as any).duration = video.duration ?? 0;
        (result as any).coverUrl = video.coverUrl || '';
        (result as any).isCommerce = !!video.isCommerce;

        analyses.push(result);
      } catch (e: any) {
        ctx.logger(`⚠️ 视频 ${video.id} 分析失败：${e.message}`);
        analyses.push({
          videoId: video.id,
          qualityScore: 0,
          hookRating: 0,
          styleCategory: 'unknown',
          suggestions: ['分析失败：' + e.message],
          generatedTags: [],
          analyzedAt: new Date().toISOString(),
          modelUsed: model,
          error: e.message,
        } as any);
      }
    }

    ctx.onProgress(100);
    ctx.logger(`分析完成：成功 ${analyses.filter((a: any) => !a.error).length}/${analyses.length}`);

    return {
      analyses,
      analysisMode,
      configSource,
      modelUsed: model,
      total: analyses.length,
    };
  }

  // ==========================================================
  //  元数据分析
  // ==========================================================
  private async analyzeByMetadata(
    video: any,
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    customPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<VideoAnalysis> {
    const metadata = video.metadata || video;

    const systemPrompt = `你是一个专业的 TikTok 视频分析师。根据视频的元数据，分析并输出 JSON。只输出 JSON。

{
  "qualityScore": 1-10,
  "hookRating": 1-10,
  "styleCategory": "tutorial|comedy|product_demo|storytelling|talent|other",
  "captionScore": 1-10,
  "viralPotential": 1-10,
  "captionStructure": "AIDA|PAS|BEFORE_AFTER|HOW_TO|STORY|OTHER",
  "targetAudience": ["标签1", "标签2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "generatedTags": ["#tag1", "#tag2", "#tag3"]
}`;

    const userPrompt = `请分析以下 TikTok 视频元数据：
标题/描述：${video.description || metadata.description || '无'}
作者：${video.author || metadata.author || '未知'}
时长：${video.duration || metadata.duration || '未知'}秒
播放量：${video.plays || metadata.plays || 0}
点赞数：${video.likes || metadata.likes || 0}
评论数：${video.comments || metadata.comments || 0}
分享数：${video.shares || metadata.shares || 0}
标签：${(metadata.hashtags || []).join(', ') || '无'}
背景音乐：${metadata.musicTitle || '无'}
是否带货：${video.isCommerce ? '是' : '否'}
${customPrompt ? `\n额外要求：${customPrompt}` : ''}`;

    const raw = await this.callChatAPI(apiBaseUrl, apiKey, model, systemPrompt, userPrompt, ctx);
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return {
      videoId: video.id,
      qualityScore: parsed.qualityScore || 7,
      hookRating: parsed.hookRating || 7,
      styleCategory: parsed.styleCategory || 'other',
      captionStructure: parsed.captionStructure || 'OTHER',
      targetAudience: parsed.targetAudience || [],
      suggestions: parsed.suggestions || [],
      generatedTags: parsed.generatedTags || [`#${video.author || 'TK视频'}`, '#内容分析'],
      rawOutput: raw,
      analyzedAt: new Date().toISOString(),
      modelUsed: model,
    };
  }

  // ==========================================================
  //  全视频分析（yt-dlp 下载 → File API 上传 → AI 分析）
  // ==========================================================
  private async analyzeVideo(
    video: any,
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    customPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<VideoAnalysis> {
    // 1. 构造 TikTok 视频页 URL
    const author = video.author;
    const videoId = video.id;
    if (!author || !videoId) throw new Error('缺少视频作者或 ID，无法构造下载地址');

    const pageUrl = `https://www.tiktok.com/@${author}/video/${videoId}`;
    ctx.logger(`  📥 通过 yt-dlp 下载视频...`);

    // 2. 使用 yt-dlp 下载
    const cacheDir = path.join(process.cwd(), '.cache', 'videos');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const tmpPath = path.join(cacheDir, `analyze_${videoId}.mp4`);

    const { execSync } = require('child_process');
    try {
      execSync(
        `yt-dlp --no-warnings -o "${tmpPath}" "${pageUrl}" 2>&1`,
        { timeout: 120000, stdio: 'pipe' },
      );
    } catch (e: any) {
      // yt-dlp 输出到 stderr 时 execSync 可能抛异常，检查文件是否存在
      if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size === 0) {
        throw new Error(`yt-dlp 下载失败：${e.message || e}`);
      }
    }
    const fileSize = fs.statSync(tmpPath).size;
    ctx.logger(`  ✅ 下载完成 (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

    // 3. 用 ffmpeg 提取关键帧（通用方案，兼容所有多模态模型）
    ctx.logger(`  🎞 提取视频帧...`);
    const framesDir = path.join(cacheDir, `frames_${videoId}`);
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

    const frameCount = 10;
    // 用 ffmpeg 均匀抽帧
    const fps = Math.max(1, Math.floor(frameCount / (video.duration || 30)));
    execSync(
      `ffmpeg -i "${tmpPath}" -vf "fps=${fps}" -q:v 2 -frames:v ${frameCount} "${framesDir}/%02d.jpg" 2>&1`,
      { timeout: 60000, stdio: 'pipe' },
    );

    // 读取帧为 base64
    const frameFiles = fs.readdirSync(framesDir).sort().slice(0, frameCount);
    if (frameFiles.length === 0) throw new Error('ffmpeg 提取帧失败');
    const frames: string[] = frameFiles.map(f =>
      `data:image/jpeg;base64,${fs.readFileSync(path.join(framesDir, f)).toString('base64')}`
    );
    ctx.logger(`  ✅ 提取 ${frames.length} 帧`);

    // 4. 构造多模态请求（将帧图片作为 image_url 发送，兼容所有 OpenAI 兼容模型）
    const systemPrompt = this.buildVideoAnalysisPrompt(customPrompt);
    ctx.logger(`  🤖 AI 分析中...`);
    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    const chatUrl = baseUrl.match(/\/v\d+\/?$/) ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const content: any[] = [];
    content.push({ type: 'text', text: `视频作者：${author}  时长：${video.duration}s  描述：${(video.description||'').slice(0,100)}` });
    frames.forEach((f, i) => {
      content.push({ type: 'image_url', image_url: { url: f } });
    });
    if (customPrompt) content.push({ type: 'text', text: `额外要求：${customPrompt}` });

    const chatResp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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

    if (!chatResp.ok) {
      const errText = await chatResp.text().catch(() => '');
      throw new Error(`分析请求失败 (${chatResp.status})：${errText.slice(0, 300)}`);
    }

    const chatData = await chatResp.json();
    const raw = chatData.choices?.[0]?.message?.content || '{}';

    // 6. 解析结构化输出
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    ctx.logger(`  ✅ 分析完成`);

    // 7. 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch {}
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}

    return {
      videoId,
      qualityScore: parsed.overallScore || parsed.qualityScore || 7,
      hookRating: parsed.structure?.hookRating || parsed.hookRating || 7,
      styleCategory: parsed.visual?.styleCategory || parsed.styleCategory || 'other',
      captionStructure: parsed.caption?.structure || parsed.captionStructure || 'OTHER',
      targetAudience: parsed.caption?.targetAudience || parsed.targetAudience || [],
      suggestions: parsed.replication?.suggestions || parsed.suggestions || [],
      generatedTags: parsed.caption?.hashtags || parsed.generatedTags || [],
      rawOutput: raw,
      analyzedAt: new Date().toISOString(),
      modelUsed: model,
    };
  }

  private buildVideoAnalysisPrompt(customPrompt: string): string {
    return `你是顶级短视频分析师。分析视频截图后输出 JSON，**只输出 JSON**。

{
  "overallScore": 1-10,
  "visual": {
    "styleCategory": "product_demo|tutorial|comedy|storytelling|talent|vlog|lifestyle|other",
    "cameraLanguage": ["镜头语言1", "镜头语言2"],
    "colorPalette": ["主色调1", "主色调2"],
    "textOverlay": true/false,
    "qualityScore": 1-10
  },
  "structure": {
    "hookType": "problem|data|visual|conflict|curiosity|other",
    "hookRating": 1-10,
    "contentFlow": ["步骤1", "步骤2"],
    "pacing": "fast|moderate|slow",
    "completionRate": 1-10
  },
  "audio": {
    "bgmMood": "energetic|calm|suspenseful|happy|epic|none",
    "voiceoverStyle": "fast_paced|conversational|professional|none"
  },
  "caption": {
    "structure": "AIDA|PAS|BEFORE_AFTER|HOW_TO|STORY|OTHER",
    "keyPhrases": ["关键词1", "关键词2"],
    "hashtags": ["#标签1", "#标签2"],
    "targetAudience": ["受众1", "受众2"]
  },
  "viral": {
    "emotionalTrigger": "共鸣|好奇|紧迫|幽默|感动|none",
    "trendAlignment": 1-10
  },
  "replication": {
    "generationPrompt": "一段可直接用于 AI 视频生成模型的提示词",
    "styleTags": ["风格标签1", "风格标签2"],
    "keyIngredients": ["核心要素1", "核心要素2"],
    "suggestions": ["优化建议1", "优化建议2"]
  }
}`;
  }

  private async callChatAPI(
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<string> {
    const baseUrl = apiBaseUrl.replace(/\/+$/, '');
    const chatUrl = baseUrl.match(/\/v\d+\/?$/) ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const resp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API 错误 (${resp.status})：${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '{}';
  }
}
