import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 数据转换节点
 * 对节点间的数据进行格式转换/过滤/映射
 */
export class TransformNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.TRANSFORM,
    label: '数据转换',
    description: '对数据进行格式转换、过滤或字段映射',
    category: 'process',
    icon: '🔄',
    inputs: [{ id: 'input', name: '输入数据', type: 'any', required: true }],
    outputs: [{ id: 'output', name: '输出数据', type: 'any', required: true }],
    defaultConfig: {
      transformType: 'filter',
      mapping: {},
    },
  };

  async execute(config: NodeConfig, input: unknown, _ctx: NodeExecutionContext): Promise<unknown> {
    return input; // 当前为直通模式，后续实现具体转换逻辑
  }
}
