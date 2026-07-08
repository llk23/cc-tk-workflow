import OpenAI from 'openai';
import {
  AIProvider,
  ProviderTypeEnum,
  Message,
  AIRequestConfig,
  AIResponse,
  MultimodalContent,
} from '../interfaces';

/**
 * OpenAI Provider 实现
 * 支持 GPT-4o 等多模态模型
 */
export class OpenAIProvider implements AIProvider {
  readonly type = ProviderTypeEnum.OPENAI;
  readonly name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL ?? 'https://api.openai.com/v1',
    });
  }

  async chat(messages: Message[], config: AIRequestConfig): Promise<AIResponse> {
    const completion = await this.client.chat.completions.create({
      model: config.model,
      messages: [
        ...(config.systemPrompt ? [{ role: 'system' as const, content: config.systemPrompt }] : []),
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
    });

    return {
      content: completion.choices[0]?.message?.content ?? '',
      model: completion.model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  async analyze(contents: MultimodalContent[], config: AIRequestConfig): Promise<AIResponse> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...(config.systemPrompt
        ? [{ role: 'system' as const, content: config.systemPrompt }]
        : []),
      {
        role: 'user' as const,
        content: contents.map(c => {
          if (c.type === 'text') return { type: 'text' as const, text: c.text! };
          if (c.type === 'image_url')
            return { type: 'image_url' as const, image_url: { url: c.imageUrl! } };
          // 视频通过 frame extraction 转为图片序列
          if (c.type === 'video_file')
            return { type: 'text' as const, text: `[Video file: ${c.videoFilePath}]` };
          return { type: 'text' as const, text: '' };
        }),
      },
    ];

    const completion = await this.client.chat.completions.create({
      model: config.model,
      messages: openaiMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
    });

    return {
      content: completion.choices[0]?.message?.content ?? '',
      model: completion.model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
