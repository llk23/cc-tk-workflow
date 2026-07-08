import {
  AIProvider,
  ProviderTypeEnum,
  Message,
  AIRequestConfig,
  AIResponse,
  MultimodalContent,
} from '../interfaces';

/**
 * Claude Provider 占位实现
 * 后续接入时实现完整的 Anthropic SDK 调用
 */
export class ClaudeProvider implements AIProvider {
  readonly type = ProviderTypeEnum.CLAUDE;
  readonly name = 'Claude';

  constructor(private apiKey: string, private baseURL?: string) {}

  async chat(_messages: Message[], _config: AIRequestConfig): Promise<AIResponse> {
    throw new Error('Claude Provider 尚未实现');
  }

  async analyze(_contents: MultimodalContent[], _config: AIRequestConfig): Promise<AIResponse> {
    throw new Error('Claude Provider 尚未实现');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
