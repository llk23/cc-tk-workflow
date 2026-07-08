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
export declare class RedisStorageAdapter implements StorageAdapter {
    private redis;
    constructor(redisClient: any);
    save(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    expire(key: string, ttl: number): Promise<void>;
}
/**
 * 内存存储适配器（开发/测试用）
 */
export declare class MemoryStorageAdapter implements StorageAdapter {
    private store;
    save(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    expire(_key: string, _ttl: number): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map