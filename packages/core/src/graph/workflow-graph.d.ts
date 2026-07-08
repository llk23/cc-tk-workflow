import { Workflow, WorkflowNode, WorkflowEdge, NodeTypeEnum } from '@tk-workflow/types';
/**
 * 工作流图
 * 将 Workflow 定义转换为可执行的有向图结构
 */
export declare class WorkflowGraph {
    private nodes;
    private edges;
    private adjacencyList;
    /**
     * 从工作流定义构建图
     */
    buildFromWorkflow(workflow: Workflow): void;
    /**
     * 获取节点的入边
     */
    getIncomingEdges(nodeId: string): WorkflowEdge[];
    /**
     * 获取节点的出边
     */
    getOutgoingEdges(nodeId: string): WorkflowEdge[];
    /**
     * 获取执行顺序（拓扑排序）
     */
    getExecutionOrder(): WorkflowNode[];
    /**
     * Kahn 算法进行拓扑排序
     */
    private topologicalSort;
    /**
     * 获取所有节点
     */
    getAllNodes(): WorkflowNode[];
    /**
     * 按类型获取节点
     */
    getNodesByType(type: NodeTypeEnum): WorkflowNode[];
}
//# sourceMappingURL=workflow-graph.d.ts.map