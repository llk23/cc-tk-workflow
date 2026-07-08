// ==========================================
// AI Provider 抽象层 — 统一接口定义
// ==========================================

/** AI 模型供应商类型 */
export enum ProviderTypeEnum {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama',
}

/** AI 请求消息类型 */
export type MessageRole = 'system' | 'user' | 'assistant';

/** 消息 */
export interface Message {
  role: MessageRole;
  content: string;
}

/** 多模态内容（支持图片/视频输入） */
export interface MultimodalContent {
  type: 'text' | 'image_url' | 'video_file';
  text?: string;
  imageUrl?: string;
  videoFilePath?: string;
}

/** AI 请求配置 */
export interface AIRequestConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/** AI 响应 */
export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 多模态分析请求 */
export interface MultimodalRequest {
  messages: MultimodalContent[];
  config: AIRequestConfig;
}

/**
 * AI Provider 统一接口
 * 所有 AI 供应商必须实现此接口
 */
export interface AIProvider {
  readonly type: ProviderTypeEnum;
  readonly name: string;

  /** 文本对话 */
  chat(messages: Message[], config: AIRequestConfig): Promise<AIResponse>;

  /** 多模态分析（图片/视频） */
  analyze(messages: MultimodalContent[], config: AIRequestConfig): Promise<AIResponse>;

  /** 检查模型是否可用 */
  isAvailable(): Promise<boolean>;
}
