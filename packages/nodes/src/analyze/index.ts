import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum, VideoAnalysis } from '@tk-workflow/types';

/**
 * AI 视频分析节点
 * 使用多模态 AI 模型分析视频内容
 */
export class AIAnalyzeVideoNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.AI_ANALYZE,
    label: 'AI 视频分析',
    description: '使用多模态 AI 模型分析视频内容、风格和质量',
    category: 'ai',
    icon: '🧠',
    inputs: [{ id: 'videos', name: '视频数据', type: 'video', required: true }],
    outputs: [{ id: 'analysis', name: '分析结果', type: 'analysis', required: true }],
    defaultConfig: {
      provider: 'openai',
      model: 'gpt-4o',
      analysisDimensions: ['quality', 'style', 'hook', 'caption', 'audience'],
      customPrompt: '',
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { provider, model, analysisDimensions, customPrompt } = config as any;
    const videos = (input as any)?.videos ?? [];

    ctx.logger(`开始 AI 视频分析，模型：${provider}/${model}`);
    ctx.logger(`分析维度：${analysisDimensions?.join(', ') ?? '全部'}`);

    if (!videos.length) {
      ctx.logger('警告：没有收到视频数据');
      return { analyses: [] };
    }

    const analyses: VideoAnalysis[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const progress = Math.round(((i + 1) / videos.length) * 100);
      ctx.onProgress(progress);

      ctx.logger(`正在分析视频 ${i + 1}/${videos.length}: ${video.id}`);

      // ====== 占位逻辑，后续对接真实 AI API ======
      // 此处会调用 packages/providers 中的多模态分析接口
      analyses.push({
        videoId: video.id,
        qualityScore: Math.round(Math.random() * 4 + 6), // 6-10
        hookRating: Math.round(Math.random() * 4 + 6),
        styleCategory: ['tutorial', 'comedy', 'product_demo', 'storytelling', 'talent'][
          Math.floor(Math.random() * 5)
        ],
        captionStructure: 'AIDA',
        suggestions: [
          '前3秒加入文字高亮效果',
          '背景音乐节奏感可以更强',
          '视频封面需要更吸引人',
        ],
        generatedTags: [`#${video.metadata?.hashtags?.[0] ?? 'TK美区'}`, '#爆款分析', '#内容优化'],
        analyzedAt: new Date().toISOString(),
        modelUsed: `${provider}/${model}`,
      });
    }

    ctx.onProgress(100);
    ctx.logger(`分析完成：共分析 ${analyses.length} 个视频`);

    return { analyses };
  }
}
