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
export function topologicalSort<T extends GraphNode>(nodes: T[]): string[] {
  const nodeMap = new Map<string, T>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }

  for (const node of nodes) {
    const deps = node.dependencies ?? [];
    for (const dep of deps) {
      const neighbors = adjacencyList.get(dep);
      if (neighbors) {
        neighbors.push(node.id);
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);

    const neighbors = adjacencyList.get(id) ?? [];
    for (const neighbor of neighbors) {
      const deg = inDegree.get(neighbor)!;
      inDegree.set(neighbor, deg - 1);
      if (deg - 1 === 0) queue.push(neighbor);
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('循环依赖检测：DAG 中存在环');
  }

  return result;
}
