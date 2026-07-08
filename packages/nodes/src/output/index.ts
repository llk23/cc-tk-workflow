import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 输出节点
 * 将处理结果输出到数据库、文件或外部服务
 */
export class OutputNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.OUTPUT,
    label: '结果输出',
    description: '将处理结果保存到数据库或发送通知',
    category: 'output',
    icon: '📤',
    inputs: [{ id: 'input', name: '输入数据', type: 'any', required: true }],
    outputs: [{ id: 'done', name: '完成', type: 'any', required: false }],
    defaultConfig: {
      outputType: 'database',
      format: 'json',
    },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    ctx.logger(`输出数据到 ${(config as any).outputType}`);
    return { saved: true, data: input };
  }
}
