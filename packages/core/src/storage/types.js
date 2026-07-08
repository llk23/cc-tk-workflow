"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageAdapter = exports.RedisStorageAdapter = void 0;
/**
 * Redis 存储适配器
 */
class RedisStorageAdapter {
    redis; // ioredis client
    constructor(redisClient) {
        this.redis = redisClient;
    }
    async save(key, value) {
        await this.redis.set(key, value);
    }
    async get(key) {
        return this.redis.get(key);
    }
    async delete(key) {
        await this.redis.del(key);
    }
    async expire(key, ttl) {
        await this.redis.expire(key, ttl);
    }
}
exports.RedisStorageAdapter = RedisStorageAdapter;
/**
 * 内存存储适配器（开发/测试用）
 */
class MemoryStorageAdapter {
    store = new Map();
    async save(key, value) {
        this.store.set(key, value);
    }
    async get(key) {
        return this.store.get(key) ?? null;
    }
    async delete(key) {
        this.store.delete(key);
    }
    async expire(_key, _ttl) {
        // 内存模式忽略 TTL
    }
}
exports.MemoryStorageAdapter = MemoryStorageAdapter;
//# sourceMappingURL=types.js.map