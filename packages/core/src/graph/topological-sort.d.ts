/**
 * 拓扑排序工具
 * 对任意 DAG 进行拓扑排序
 */
export interface GraphNode {
    id: string;
    dependencies?: string[];
}
/**
 * 通用拓扑排序 — Kahn 算法
 * 输入：节点列表，每个节点可声明依赖
 * 输出：排序后的节点 ID 列表
 * 抛出：如果存在循环依赖
 */
export declare function topologicalSort<T extends GraphNode>(nodes: T[]): string[];
//# sourceMappingURL=topological-sort.d.ts.map