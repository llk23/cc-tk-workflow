import {
  AIProvider,
  ProviderTypeEnum,
  Message,
  AIRequestConfig,
  AIResponse,
  MultimodalContent,
} from '../interfaces';

/**
 * Ollama Provider 占位实现
 * 后续接入本地模型
 */
export class OllamaProvider implements AIProvider {
  readonly type = ProviderTypeEnum.OLLAMA;
  readonly name = 'Ollama';

  constructor(private baseURL: string = 'http://localhost:11434') {}

  async chat(_messages: Message[], _config: AIRequestConfig): Promise<AIResponse> {
    throw new Error('Ollama Provider 尚未实现');
  }

  async analyze(_contents: MultimodalContent[], _config: AIRequestConfig): Promise<AIResponse> {
    throw new Error('Ollama Provider 尚未实现');
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
