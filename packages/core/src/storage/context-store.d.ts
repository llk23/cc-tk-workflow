import { ExecutionContext } from '@tk-workflow/types';
import { StorageAdapter } from './types';
/**
 * Context Store
 * 管理工作流执行期间的上下文数据
 * 支持 Redis 和内存两种存储后端
 */
export declare class ContextStore {
    private adapter;
    private readonly PREFIX;
    private readonly DEFAULT_TTL;
    constructor(adapter?: StorageAdapter);
    /**
     * 保存执行上下文
     */
    saveContext(context: ExecutionContext): Promise<void>;
    /**
     * 获取执行上下文
     */
    getContext(pipelineId: string): Promise<ExecutionContext | null>;
    /**
     * 删除执行上下文
     */
    deleteContext(pipelineId: string): Promise<void>;
    /**
     * 更新上下文中的共享数据
     */
    updateSharedData(pipelineId: string, key: string, value: unknown): Promise<void>;
    private buildKey;
}
//# sourceMappingURL=context-store.d.ts.map