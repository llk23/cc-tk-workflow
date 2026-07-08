"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextStore = void 0;
const types_1 = require("./types");
/**
 * Context Store
 * 管理工作流执行期间的上下文数据
 * 支持 Redis 和内存两种存储后端
 */
class ContextStore {
    adapter;
    PREFIX = 'pipeline:ctx:';
    DEFAULT_TTL = 86400; // 24h
    constructor(adapter) {
        this.adapter = adapter ?? new types_1.MemoryStorageAdapter();
    }
    /**
     * 保存执行上下文
     */
    async saveContext(context) {
        const key = this.buildKey(context.pipelineId);
        const value = JSON.stringify(context);
        await this.adapter.save(key, value);
        await this.adapter.expire(key, this.DEFAULT_TTL);
    }
    /**
     * 获取执行上下文
     */
    async getContext(pipelineId) {
        const key = this.buildKey(pipelineId);
        const value = await this.adapter.get(key);
        if (!value)
            return null;
        return JSON.parse(value);
    }
    /**
     * 删除执行上下文
     */
    async deleteContext(pipelineId) {
        const key = this.buildKey(pipelineId);
        await this.adapter.delete(key);
    }
    /**
     * 更新上下文中的共享数据
     */
    async updateSharedData(pipelineId, key, value) {
        const context = await this.getContext(pipelineId);
        if (context) {
            context.sharedData[key] = value;
            await this.saveContext(context);
        }
    }
    buildKey(pipelineId) {
        return `${this.PREFIX}${pipelineId}`;
    }
}
exports.ContextStore = ContextStore;
//# sourceMappingURL=context-store.js.map