import { WorkflowNode, NodeResult, NodeConfig } from '@tk-workflow/types';
/**
 * 节点执行器
 * 负责调度单个节点的执行，包含重试逻辑
 */
export declare class NodeExecutor {
    private maxRetries;
    private retryDelay;
    /**
     * 执行单个节点
     */
    executeNode(node: WorkflowNode, input: unknown): Promise<NodeResult>;
    /**
     * 实际调用节点处理器
     * 由外部注册的处理器映射来执行
     */
    private runNodeHandler;
    /** 节点处理器注册表 */
    private static handlers;
    /** 注册节点处理器 */
    static registerHandler(nodeType: string, handler: NodeHandler): void;
    private delay;
}
/** 节点处理器类型 */
export type NodeHandler = (config: NodeConfig, input: unknown) => Promise<unknown>;
//# sourceMappingURL=executor.d.ts.map