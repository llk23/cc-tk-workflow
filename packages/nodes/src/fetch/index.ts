import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * TK 视频抓取节点
 * 从 TikTok 或第三方数据平台抓取视频
 */
export class FetchTKVideoNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.FETCH_TK,
    label: 'TK 视频抓取',
    description: '从 TikTok 平台或分析网站抓取视频数据',
    category: 'input',
    icon: '📥',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'videos', name: '视频列表', type: 'video', required: true }],
    defaultConfig: {
      source: 'tikapi',
      keyword: '',
      count: 10,
      filters: { minPlays: 100000 },
      autoDownload: true,
    },
  };

  async execute(config: NodeConfig, _input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { source, keyword, count, filters, autoDownload } = config as any;

    ctx.logger(`开始从 ${source} 抓取 TK 视频，关键词：${keyword}，数量：${count}`);

    // ====== 占位逻辑，后续对接真实 API ======
    ctx.onProgress(30);
    ctx.logger(`正在搜索关键词 "${keyword}"...`);

    ctx.onProgress(60);
    ctx.logger(`找到 ${count} 个视频，正在获取元数据...`);

    if (autoDownload) {
      ctx.onProgress(80);
      ctx.logger('正在下载视频文件...');
    }

    ctx.onProgress(100);
    ctx.logger(`抓取完成：成功获取 ${count} 个视频`);

    // 返回模拟结果
    return {
      videos: Array.from({ length: count }, (_, i) => ({
        id: `tk_${Date.now()}_${i}`,
        url: `https://tiktok.com/@user/video/example_${i}`,
        metadata: {
          plays: Math.floor(Math.random() * 1000000),
          likes: Math.floor(Math.random() * 100000),
          comments: Math.floor(Math.random() * 10000),
          shares: Math.floor(Math.random() * 5000),
          duration: Math.floor(Math.random() * 60) + 15,
          author: '@user',
          description: `Example TK video ${i}`,
          hashtags: [keyword],
        },
        status: autoDownload ? 'downloaded' : 'pending',
        fetchedAt: new Date().toISOString(),
      })),
      source,
      keyword,
      fetchedAt: new Date().toISOString(),
    };
  }
}
