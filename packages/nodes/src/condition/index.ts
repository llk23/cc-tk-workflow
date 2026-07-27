import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 条件判断节点
 *
 * 接收上游视频数组，按每个视频的字段做数值比较，只输出符合条件的视频。
 * 典型用法：duration > 30 → 走抽帧分析；duration <= 30 → 走全视频分析
 *
 * 输入格式：{ videos: [{ id, duration, plays, likes, ... }] }
 * 输出格式：{ videos: [...matched], filtered: { total, matched, unmatched } }
 */
export class ConditionNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.CONDITION,
    label: '条件判断',
    description: '按视频字段（时长/播放量/点赞数）筛选视频数据',
    category: 'process',
    icon: '🔀',
    inputs: [{ id: 'input', name: '视频数据', type: 'any', required: true }],
    outputs: [{ id: 'output', name: '筛选结果', type: 'any', required: true }],
    defaultConfig: {
      field: 'duration',
      operator: 'gt',
      value: 30,
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { field = 'duration', operator = 'gt', value = 0 } = config as any;

    const inputObj = (input || {}) as any;
    const videos: any[] = inputObj.videos ?? [];

    if (!videos.length) {
      ctx.logger('条件判断：未收到视频数据');
      return { videos: [], filtered: { total: 0, matched: 0, unmatched: 0 } };
    }

    const operatorLabels: Record<string, string> = {
      eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', contains: '包含',
    };
    ctx.logger(`条件判断：${field} ${operatorLabels[operator] || operator} ${value}，共 ${videos.length} 条视频`);

    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const v of videos) {
      const actualValue = (v as any)[field];
      let pass = false;

      switch (operator) {
        case 'eq': pass = actualValue === value; break;
        case 'neq': pass = actualValue !== value; break;
        case 'gt': pass = (actualValue as number) > value; break;
        case 'gte': pass = (actualValue as number) >= value; break;
        case 'lt': pass = (actualValue as number) < value; break;
        case 'lte': pass = (actualValue as number) <= value; break;
        case 'contains': pass = String(actualValue).includes(String(value)); break;
      }

      if (pass) matched.push(v);
      else unmatched.push(v);
    }

    ctx.logger(`条件判断结果：${matched.length} 条符合，${unmatched.length} 条不符合`);

    return {
      videos: matched,
      filtered: {
        total: videos.length,
        matched: matched.length,
        unmatched: unmatched.length,
        field,
        operator,
        value,
      },
    };
  }
}
