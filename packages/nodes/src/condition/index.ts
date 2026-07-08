import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 条件判断节点
 * 根据配置的条件表达式路由到不同分支
 */
export class ConditionNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.CONDITION,
    label: '条件判断',
    description: '根据条件将数据路由到不同分支',
    category: 'process',
    icon: '🔀',
    inputs: [{ id: 'input', name: '输入数据', type: 'any', required: true }],
    outputs: [
      { id: 'true', name: '条件满足', type: 'any', required: false },
      { id: 'false', name: '条件不满足', type: 'any', required: false },
    ],
    defaultConfig: {
      field: '',
      operator: 'gt',
      value: 0,
    },
  };

  async execute(config: NodeConfig, input: unknown, _ctx: NodeExecutionContext): Promise<unknown> {
    const { field, operator, value } = config as any;

    const inputObj = input as Record<string, unknown>;
    const actualValue = field ? inputObj?.[field] : input;

    let result = false;
    switch (operator) {
      case 'eq': result = actualValue === value; break;
      case 'neq': result = actualValue !== value; break;
      case 'gt': result = (actualValue as number) > value; break;
      case 'gte': result = (actualValue as number) >= value; break;
      case 'lt': result = (actualValue as number) < value; break;
      case 'lte': result = (actualValue as number) <= value; break;
      case 'contains': result = String(actualValue).includes(String(value)); break;
    }

    return { condition: result, input };
  }
}
