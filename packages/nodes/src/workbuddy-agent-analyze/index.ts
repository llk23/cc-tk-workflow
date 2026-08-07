// ==========================================
// WorkBuddy Agent 视频分析节点（通用版）
// ==========================================
// 作用：通过 codebuddy CLI 调起 WorkBuddy Agent，让 Agent 使用
//       上游 skill 节点选定的技能分析视频。
// 配置：只保留「分析要求模板」；CLI/Node/模型/权限/工作目录全部
//       从上游 model-config 节点的 modelConfig 读取，skill 内容
//       从上游 skill-config 节点的 skill 对象读取。
// ==========================================

import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/** 默认分析要求模板（用户可在配置面板修改） */
const DEFAULT_PROMPT_TEMPLATE = `分析这个本地视频文件，输出：
1. 视频分析报告（画面、分镜、运镜、卖点、风格等）
2. 可直接在 Seedance 2.0 中使用的复刻提示词`;

export class WorkbuddyAgentAnalyzeNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.AI_ANALYZE_WORKBUDDY_AGENT,
    label: 'Agent 分析',
    description: '调起 WorkBuddy Agent，使用上游选定的 skill 分析视频（配置来自上游模型配置节点）',
    category: 'ai',
    icon: '🤖',
    inputs: [{ id: 'videos', name: '视频数据', type: 'video', required: true }],
    outputs: [{ id: 'analysis', name: '分析结果', type: 'analysis', required: true }],
    defaultConfig: {
      customPrompt: DEFAULT_PROMPT_TEMPLATE,
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const inputObj = (input || {}) as any;
    const videos = inputObj.videos ?? [];
    const cfg = config as any;
    const customPrompt = cfg.customPrompt || DEFAULT_PROMPT_TEMPLATE;

    // ---- 从上游 model-config 读取 Agent 运行时配置 ----
    const mc = inputObj.modelConfig || {};
    const cliPath = String(mc.cliPath || '').trim();
    const nodePath = String(mc.nodePath || '').trim() || 'node';
    const model = String(mc.agentModel || '').trim(); // WorkBuddy CLI 网关模型（空则走 auto）
    const permissionMode = String(mc.permissionMode || 'bypassPermissions').trim();
    const workingDir = String(mc.workingDir || '').trim() || 'D:/cursor-use/TK-workflow-cc';

    // ---- 从上游 skill 节点读取技能内容 ----
    const skill = inputObj.skill || {};
    const skillName = String(skill.name || '').trim();
    const skillContent = String(skill.content || '').trim();

    ctx.logger(`[WB-Agent] CLI=${cliPath || '(未配置)'} node=${nodePath} model=${model || '(默认)'} perm=${permissionMode}`);
    ctx.logger(`[WB-Agent] skill=${skillName || '(未选择)'} 共 ${videos.length} 个视频`);

    if (!cliPath) {
      ctx.logger('⚠️ 未找到 codebuddy CLI，请在上游模型配置节点填写 WorkBuddy CLI 路径');
      return { analyses: [], error: '未配置 WorkBuddy CLI（上游 modelConfig.cliPath）' };
    }
    if (!videos.length) {
      ctx.logger('警告：没有收到视频数据');
      return { analyses: [], error: '无视频输入' };
    }

    const analyses: any[] = [];
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      ctx.onProgress(Math.round((i / videos.length) * 100));
      ctx.logger(`分析 ${i + 1}/${videos.length}: ${video.id}`);

      try {
        const result = await this.analyzeSingle(
          video, nodePath, cliPath, model, workingDir, permissionMode,
          skillName, skillContent, customPrompt, ctx,
        );
        analyses.push({
          ...result,
          author: video.author || '',
          description: video.description || '',
          plays: video.plays ?? 0,
          likes: video.likes ?? 0,
          duration: video.duration ?? 0,
          coverUrl: video.coverUrl || '',
          isCommerce: !!video.isCommerce,
        });
      } catch (e: any) {
        ctx.logger(`⚠️ ${video.id} 失败：${e.message}`);
        analyses.push({
          videoId: video.id,
          rawOutput: '',
          analyzedAt: new Date().toISOString(),
          error: e.message,
        });
      }
    }

    ctx.onProgress(100);
    ctx.logger(`完成：成功 ${analyses.filter((a: any) => !a.error).length}/${analyses.length}`);

    return {
      analyses,
      cliPath,
      nodePath,
      modelUsed: model || '(CLI默认)',
      workingDir,
      skillUsed: skillName || '(未选择)',
      total: analyses.length,
    };
  }

  private async analyzeSingle(
    video: any,
    nodePath: string,
    cliPath: string,
    model: string,
    workingDir: string,
    permissionMode: string,
    skillName: string,
    skillContent: string,
    customPrompt: string,
    ctx: NodeExecutionContext,
  ): Promise<any> {
    const { author, id: videoId } = video;
    if (!author || !videoId) throw new Error('缺少视频作者或 ID');

    const pageUrl = `https://www.tiktok.com/@${author}/video/${videoId}`;

    // ---- 1. 下载视频到本地缓存 ----
    const cacheDir = path.join(process.cwd(), '.cache', 'workbuddy-agent-videos');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const localPath = path.join(cacheDir, `wb_${videoId}.mp4`);

    ctx.logger(`  📥 yt-dlp 下载视频...`);
    try {
      await this.runCommand('yt-dlp', ['--no-warnings', '-o', localPath, pageUrl], 120000);
    } catch (e: any) {
      if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
        throw new Error(`yt-dlp 下载失败：${(e.message || '').slice(0, 120)}`);
      }
    }
    ctx.logger(`  ✅ 下载完成 (${(fs.statSync(localPath).size / 1024 / 1024).toFixed(1)}MB)`);

    // ---- 2. 构造 Agent 任务提示词 ----
    // 有 skill 内容时直接注入（Agent 无需自行发现技能文件），无 skill 时让 Agent 自由发挥
    const skillClause = skillContent
      ? `\n【技能指南】\n以下是本次任务使用的技能《${skillName || 'skill'}》完整内容，请严格按其指导进行分析与输出：\n\n${skillContent}`
      : '';

    const taskPrompt = `
你是 WorkBuddy Agent。请完成以下视频分析任务：

分析这个本地视频文件：${localPath}
TikTok 页面：${pageUrl}
作者：${author}
描述：${video.description || '(无)'}
播放量：${video.plays ?? '-'}  点赞：${video.likes ?? '-'}  时长：${video.duration ?? '-'}s
${skillClause}

【任务要求】
${customPrompt}

注意：请直接输出分析结果，不要输出过程日志。
`.trim();

    // ---- 3. 调起 codebuddy CLI ----
    ctx.logger(`  🤖 调起 WorkBuddy Agent...`);
    // 注意：prompt 必须放在 --add-dir 之前（--add-dir 会吞掉其后所有参数）
    const args = [
      cliPath,
      '-p',
      '--output-format', 'json',
      '--permission-mode', permissionMode,
      taskPrompt,
      '--add-dir', path.dirname(localPath),
    ];
    if (model) args.push('--model', model);

    const raw = await this.runCommand(nodePath, args, 300000, 64 * 1024 * 1024, workingDir);
    ctx.logger(`  ✅ Agent 返回 (${raw.length} 字符)`);

    // ---- 4. 清理 ----
    try { fs.unlinkSync(localPath); } catch {}

    return {
      videoId,
      rawOutput: raw,
      analyzedAt: new Date().toISOString(),
      modelUsed: model || '(CLI默认)',
      cliPath,
      skillUsed: skillName || '(未选择)',
    };
  }

  /** 执行子进程命令（Promise 封装，支持超时与大数据量输出） */
  private runCommand(cmd: string, args: string[], timeoutMs = 120000, maxBuffer = 16 * 1024 * 1024, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout: timeoutMs, maxBuffer, windowsHide: true, encoding: 'utf-8', cwd }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr || stdout || err.message || '').slice(0, 300)));
          return;
        }
        resolve(stdout);
      });
    });
  }
}
