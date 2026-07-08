import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * AI 视频生成节点
 * 基于分析结果调用外部 AI 视频生成工具
 */
export class VideoGenerateNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.VIDEO_GENERATE,
    label: 'AI 视频生成',
    description: '基于分析结果，调用 AI 视频生成工具创作新视频',
    category: 'output',
    icon: '🎬',
    inputs: [
      { id: 'videos', name: '参考视频', type: 'video', required: false },
      { id: 'analysis', name: '分析结果', type: 'analysis', required: true },
    ],
    outputs: [{ id: 'generated', name: '生成任务', type: 'any', required: true }],
    defaultConfig: {
      tool: 'runway',
      prompt: '',
      resolution: '1080p',
      aspectRatio: '9:16',
      duration: 15,
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { tool, prompt, resolution, aspectRatio, duration } = config as any;
    const { analyses, videos } = input as any;

    ctx.logger(`开始 AI 视频生成，工具：${tool}`);
    ctx.logger(`分辨率：${resolution}，比例：${aspectRatio}，时长：${duration}s`);

    if (!analyses?.length) {
      ctx.logger('警告：没有分析结果，使用原始 prompt 生成');
    }

    // 如果有分析结果，自动生成优化后的 prompt
    const finalPrompt = analyses?.[0]
      ? this.buildPromptFromAnalysis(analyses[0], prompt)
      : prompt;

    ctx.logger(`生成 Prompt: ${finalPrompt.substring(0, 100)}...`);

    // ====== 占位逻辑，后续对接真实视频生成 API ======
    ctx.onProgress(50);
    ctx.logger('正在提交视频生成任务...');

    ctx.onProgress(100);
    ctx.logger('视频生成任务已提交');

    return {
      taskId: `gen_${Date.now()}`,
      tool,
      prompt: finalPrompt,
      status: 'queued',
      createdAt: new Date().toISOString(),
      resultUrl: null,
    };
  }

  private buildPromptFromAnalysis(analysis: any, userPrompt: string): string {
    const styleHints = [];
    if (analysis.styleCategory) styleHints.push(`风格：${analysis.styleCategory}`);
    if (analysis.suggestions?.length) {
      styleHints.push(`优化建议：${analysis.suggestions.slice(0, 2).join('，')}`);
    }
    if (analysis.generatedTags?.length) {
      styleHints.push(`标签：${analysis.generatedTags.join(' ')}`);
    }

    const analysisSummary = styleHints.length ? `（基于分析：${styleHints.join(' | ')}）` : '';

    return userPrompt
      ? `${userPrompt}\n\n${analysisSummary}`
      : `生成一个 ${analysis.styleCategory ?? '短视频'}风格的视频${analysisSummary}`;
  }
}
