import { Workflow, WorkflowNode, WorkflowEdge, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 工作流图
 * 将 Workflow 定义转换为可执行的有向图结构
 */
export class WorkflowGraph {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];
  private adjacencyList: Map<string, string[]> = new Map();

  /**
   * 从工作流定义构建图
   */
  buildFromWorkflow(workflow: Workflow): void {
    this.nodes.clear();
    this.edges = [];
    this.adjacencyList.clear();

    for (const node of workflow.nodes) {
      this.nodes.set(node.id, node);
    }

    this.edges = workflow.edges;

    // 构建邻接表
    for (const node of workflow.nodes) {
      this.adjacencyList.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      const neighbors = this.adjacencyList.get(edge.source);
      if (neighbors) {
        neighbors.push(edge.target);
      }
    }
  }

  /**
   * 获取节点的入边
   */
  getIncomingEdges(nodeId: string): WorkflowEdge[] {
    return this.edges.filter(e => e.target === nodeId);
  }

  /**
   * 获取节点的出边
   */
  getOutgoingEdges(nodeId: string): WorkflowEdge[] {
    return this.edges.filter(e => e.source === nodeId);
  }

  /**
   * 获取执行顺序（拓扑排序）
   */
  getExecutionOrder(): WorkflowNode[] {
    const sorted = this.topologicalSort();
    return sorted.map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Kahn 算法进行拓扑排序
   */
  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // 初始化入度
    for (const nodeId of this.adjacencyList.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edge of this.edges) {
      const current = inDegree.get(edge.target) ?? 0;
      inDegree.set(edge.target, current + 1);
    }

    // 入度为0的节点入队（起始节点）
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)!;
        inDegree.set(neighbor, degree - 1);
        if (degree - 1 === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== this.nodes.size) {
      throw new Error('工作流包含循环依赖，无法执行');
    }

    return result;
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 按类型获取节点
   */
  getNodesByType(type: NodeTypeEnum): WorkflowNode[] {
    return this.getAllNodes().filter(n => n.type === type);
  }
}
