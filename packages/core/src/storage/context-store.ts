import { ExecutionContext } from '@tk-workflow/types';
import { StorageAdapter, MemoryStorageAdapter } from './types';

/**
 * Context Store
 * 管理工作流执行期间的上下文数据
 * 支持 Redis 和内存两种存储后端
 */
export class ContextStore {
  private adapter: StorageAdapter;
  private readonly PREFIX = 'pipeline:ctx:';
  private readonly DEFAULT_TTL = 86400; // 24h

  constructor(adapter?: StorageAdapter) {
    this.adapter = adapter ?? new MemoryStorageAdapter();
  }

  /**
   * 保存执行上下文
   */
  async saveContext(context: ExecutionContext): Promise<void> {
    const key = this.buildKey(context.pipelineId);
    const value = JSON.stringify(context);
    await this.adapter.save(key, value);
    await this.adapter.expire(key, this.DEFAULT_TTL);
  }

  /**
   * 获取执行上下文
   */
  async getContext(pipelineId: string): Promise<ExecutionContext | null> {
    const key = this.buildKey(pipelineId);
    const value = await this.adapter.get(key);
    if (!value) return null;
    return JSON.parse(value) as ExecutionContext;
  }

  /**
   * 删除执行上下文
   */
  async deleteContext(pipelineId: string): Promise<void> {
    const key = this.buildKey(pipelineId);
    await this.adapter.delete(key);
  }

  /**
   * 更新上下文中的共享数据
   */
  async updateSharedData(
    pipelineId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    const context = await this.getContext(pipelineId);
    if (context) {
      context.sharedData[key] = value;
      await this.saveContext(context);
    }
  }

  private buildKey(pipelineId: string): string {
    return `${this.PREFIX}${pipelineId}`;
  }
}
