"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeExecutor = void 0;
/**
 * 节点执行器
 * 负责调度单个节点的执行，包含重试逻辑
 */
class NodeExecutor {
    maxRetries = 3;
    retryDelay = 1000; // ms
    /**
     * 执行单个节点
     */
    async executeNode(node, input) {
        const startedAt = new Date().toISOString();
        const startTime = Date.now();
        let lastError = null;
        let attempts = 0;
        while (attempts <= this.maxRetries) {
            try {
                // 这里通过注册的节点处理器来执行实际逻辑
                // 实际运行时，节点处理器由 packages/nodes 注册进来
                const output = await this.runNodeHandler(node, input);
                return {
                    nodeId: node.id,
                    status: 'success',
                    input,
                    output,
                    startedAt,
                    completedAt: new Date().toISOString(),
                    duration: Date.now() - startTime,
                    retries: attempts,
                };
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                attempts++;
                if (attempts <= this.maxRetries) {
                    await this.delay(this.retryDelay * attempts);
                }
            }
        }
        return {
            nodeId: node.id,
            status: 'failed',
            input,
            error: lastError?.message ?? 'Unknown error',
            startedAt,
            completedAt: new Date().toISOString(),
            duration: Date.now() - startTime,
            retries: attempts - 1,
        };
    }
    /**
     * 实际调用节点处理器
     * 由外部注册的处理器映射来执行
     */
    async runNodeHandler(node, input) {
        // 从注册表中查找处理器
        const handler = NodeExecutor.handlers.get(node.type);
        if (!handler) {
            throw new Error(`No handler registered for node type: ${node.type}`);
        }
        return handler(node.config, input);
    }
    /** 节点处理器注册表 */
    static handlers = new Map();
    /** 注册节点处理器 */
    static registerHandler(nodeType, handler) {
        NodeExecutor.handlers.set(nodeType, handler);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.NodeExecutor = NodeExecutor;
//# sourceMappingURL=executor.js.map