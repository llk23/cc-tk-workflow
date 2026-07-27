import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

/**
 * AI 模型配置节点
 *
 * 让用户自行配置多模态分析模型（OpenAI 兼容接口）。
 * 输出 modelConfig 对象供下游 AI 分析节点使用。
 *
 * 使用方式：
 *   模型配置节点 → (连线) → AI 视频分析节点
 *   分析节点自动从上游输入读取 apiBaseUrl / apiKey / model
 */
export class ModelConfigNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.MODEL_CONFIG,
    label: 'AI 模型配置',
    description: '配置多模态分析模型（兼容 OpenAI API 格式，支持通义千问VL/GLM-4V/DeepSeek-VL等）',
    category: 'config',
    icon: '🤖',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'model-config', name: '模型配置', type: 'any', required: true }],
    defaultConfig: {
      apiBaseUrl: '',
      apiKey: '',
      model: '',
    },
  };

  async execute(config: NodeConfig, _input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const { apiBaseUrl, apiKey, model } = config as any;

    // 校验必填字段
    const missing: string[] = [];
    if (!apiBaseUrl) missing.push('API 地址 (apiBaseUrl)');
    if (!apiKey) missing.push('API Key (apiKey)');
    if (!model) missing.push('模型名 (model)');

    if (missing.length > 0) {
      throw new Error(`模型配置不完整，缺少：${missing.join('、')}`);
    }

    ctx.logger(`模型配置验证通过：${apiBaseUrl} / ${model}`);

    return {
      apiBaseUrl,
      apiKey,
      model,
      configured: true,
    };
  }
}
