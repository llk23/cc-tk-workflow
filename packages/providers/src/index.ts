// ==========================================
// AI Provider 统一导出 & Provider 注册表
// ==========================================

export * from './interfaces';
export { OpenAIProvider } from './openai';
export { ClaudeProvider } from './claude';
export { OllamaProvider } from './ollama';

import { AIProvider, ProviderTypeEnum } from './interfaces';

/**
 * Provider 注册表
 * 管理所有可用的 AI Provider
 */
export class ProviderRegistry {
  private providers = new Map<ProviderTypeEnum, AIProvider>();

  /** 注册 Provider */
  register(provider: AIProvider): void {
    this.providers.set(provider.type, provider);
  }

  /** 获取指定类型的 Provider */
  get(type: ProviderTypeEnum): AIProvider | undefined {
    return this.providers.get(type);
  }

  /** 获取所有已注册的 Provider */
  getAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /** 创建默认 Provider 集合 */
  static createDefault(env: Record<string, string | undefined>): ProviderRegistry {
    const registry = new ProviderRegistry();

    const { OpenAIProvider: OpenAIClass } = require('./openai');
    if (env['OPENAI_API_KEY']) {
      registry.register(new OpenAIClass(env['OPENAI_API_KEY']));
    }

    return registry;
  }
}
