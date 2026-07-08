import { ExecutionContext } from '@tk-workflow/types';
import { ContextStore } from './context-store';

/**
 * Context Store 类型定义
 * 定义存储后端需要实现的接口
 */
export interface StorageAdapter {
  save(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  expire(key: string, ttl: number): Promise<void>;
}

/**
 * Redis 存储适配器
 */
export class RedisStorageAdapter implements StorageAdapter {
  private redis: any; // ioredis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async save(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl);
  }
}

/**
 * 内存存储适配器（开发/测试用）
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async save(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async expire(_key: string, _ttl: number): Promise<void> {
    // 内存模式忽略 TTL
  }
}
