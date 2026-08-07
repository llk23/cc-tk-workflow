import {
  Workflow,
  PipelineExecution,
  ExecutionStatusEnum,
  ExecutionContext,
  NodeResult,
  WorkflowNode,
  NodeTypeEnum,
} from '@tk-workflow/types';
import { randomUUID } from 'crypto';
import { WorkflowGraph } from '../graph/workflow-graph';
import { NodeExecutor } from './executor';
import { ContextStore } from '../storage/context-store';

/**
 * Pipeline 执行引擎
 * 负责整个工作流的生命周期管理：从图构建到节点执行再到结果收集
 */
export class PipelineEngine {
  private graph: WorkflowGraph;
  private executor: NodeExecutor;
  private store: ContextStore;

  constructor(store: ContextStore) {
    this.graph = new WorkflowGraph();
    this.executor = new NodeExecutor();
    this.store = store;
  }

  /**
   * 加载工作流定义，构建执行图
   */
  loadWorkflow(workflow: Workflow): void {
    this.graph.buildFromWorkflow(workflow);
  }

  /**
   * 执行整个 Pipeline
   * 按拓扑排序依次执行节点
   */
  async execute(
    workflow: Workflow,
    initialConfig?: Record<string, unknown>,
    hooks?: {
      onNodeStart?: (node: WorkflowNode) => void | Promise<void>;
      onNodeComplete?: (result: NodeResult) => void | Promise<void>;
    },
  ): Promise<PipelineExecution> {
    this.loadWorkflow(workflow);

    const execution: PipelineExecution = {
      id: this.generateId(),
      workflowId: workflow.id,
      status: ExecutionStatusEnum.RUNNING,
      progress: 0,
      startedAt: new Date().toISOString(),
      context: {
        pipelineId: this.generateId(),
        createdAt: new Date().toISOString(),
        config: initialConfig ?? {},
        nodeResults: {},
        sharedData: {},
        progress: 0,
        status: ExecutionStatusEnum.RUNNING,
      },
    };

    // 保存初始上下文
    await this.store.saveContext(execution.context);

    try {
      // 拓扑排序获取执行顺序
      const sortedNodes = this.graph.getExecutionOrder();

      for (let i = 0; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        const nodeInput = this.collectNodeInput(node.id, execution.context);

        await hooks?.onNodeStart?.(node);

        // 执行节点
        const result: NodeResult = await this.executor.executeNode(node, nodeInput);

        await hooks?.onNodeComplete?.(result);

        // 保存节点执行结果
        execution.context.nodeResults[node.id] = result;
        execution.context.sharedData[`node_${node.id}_output`] = result.output;
        execution.context.progress = Math.round(((i + 1) / sortedNodes.length) * 100);
        execution.progress = execution.context.progress;

        // 更新上下文到 Redis
        await this.store.saveContext(execution.context);

        // 如果节点执行失败，视策略决定是否继续
        if (result.status === 'failed') {
          execution.status = ExecutionStatusEnum.FAILED;
          execution.error = `Node ${node.label} (${node.id}) failed: ${result.error}`;
          await this.store.saveContext(execution.context);
          return execution;
        }
      }

      execution.status = ExecutionStatusEnum.COMPLETED;
      execution.completedAt = new Date().toISOString();
      execution.context.status = ExecutionStatusEnum.COMPLETED;
      await this.store.saveContext(execution.context);
    } catch (err) {
      execution.status = ExecutionStatusEnum.FAILED;
      execution.error = err instanceof Error ? err.message : 'Unknown pipeline error';
      execution.context.status = ExecutionStatusEnum.FAILED;
      await this.store.saveContext(execution.context);
    }

    return execution;
  }

  /**
   * 收集节点的输入数据（从前序节点的输出中提取）
   *
   * 与 workflow.service.ts 的 executeUpstreamNodes 保持一致的契约：
   * - 单上游：直接返回该节点的输出（平铺），下游用 inputObj.videos / inputObj.cookie 等读取
   * - 多上游：将每个上游输出拆解后平铺合并到根，避免嵌套在 nodeId 下
   */
  private collectNodeInput(nodeId: string, context: ExecutionContext): unknown {
    const upstreamOutputs: Record<string, unknown> = {};
    const edges = this.graph.getIncomingEdges(nodeId);
    // 构建 节点id → 类型 映射（用于识别 model-config / skill-config 特殊包装）
    const typeById = new Map<string, string>(
      this.graph.getAllNodes().map((n) => [n.id, n.type]),
    );

    for (const edge of edges) {
      const sourceResult = context.nodeResults[edge.source];
      if (sourceResult?.output !== undefined) {
        const srcType = typeById.get(edge.source);
        if (srcType === NodeTypeEnum.MODEL_CONFIG) {
          upstreamOutputs.modelConfig = sourceResult.output;
        } else if (srcType === NodeTypeEnum.SKILL_CONFIG) {
          upstreamOutputs.skill = sourceResult.output;
        } else {
          upstreamOutputs[edge.source] = sourceResult.output;
        }
      }
    }

    const keys = Object.keys(upstreamOutputs);
    if (keys.length === 0) return undefined;
    if (keys.length === 1) return upstreamOutputs[keys[0]];

    // 多上游合并：modelConfig/skill 保留对象结构，其余拆解平铺到根
    const merged: Record<string, unknown> = {};
    for (const [key, output] of Object.entries(upstreamOutputs)) {
      if (key === 'modelConfig' || key === 'skill') {
        merged[key] = output;
      } else if (output && typeof output === 'object' && !Array.isArray(output)) {
        Object.assign(merged, output as Record<string, unknown>);
      } else {
        merged[key] = output;
      }
    }
    return merged;
  }

  /**
   * 获取执行进度
   */
  async getProgress(pipelineId: string): Promise<ExecutionContext | null> {
    return this.store.getContext(pipelineId);
  }

  /**
   * 取消执行
   */
  async cancel(pipelineId: string): Promise<void> {
    const context = await this.store.getContext(pipelineId);
    if (context) {
      context.status = ExecutionStatusEnum.CANCELLED;
      await this.store.saveContext(context);
    }
  }

  private generateId(): string {
    return randomUUID();
  }
}
