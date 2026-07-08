import {
  Workflow,
  PipelineExecution,
  ExecutionStatusEnum,
  ExecutionContext,
  NodeResult,
} from '@tk-workflow/types';
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
  async execute(workflow: Workflow, initialConfig?: Record<string, unknown>): Promise<PipelineExecution> {
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

        // 执行节点
        const result: NodeResult = await this.executor.executeNode(node, nodeInput);

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
   */
  private collectNodeInput(nodeId: string, context: ExecutionContext): unknown {
    const input: Record<string, unknown> = {};
    const edges = this.graph.getIncomingEdges(nodeId);

    for (const edge of edges) {
      const sourceResult = context.nodeResults[edge.source];
      if (sourceResult?.output) {
        input[edge.source] = sourceResult.output;
      }
    }

    return input;
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
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }
}
