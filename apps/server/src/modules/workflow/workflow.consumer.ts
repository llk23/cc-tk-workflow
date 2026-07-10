import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { NodeExecutor, PipelineEngine, ContextStore } from '@tk-workflow/core';
import { registerBuiltinNodes } from '@tk-workflow/nodes';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';

/**
 * 【wb添加 / Phase 3】BullMQ Worker
 * 消费 "workflow" 队列任务，真实驱动 PipelineEngine 执行工作流。
 * 每个节点开始/完成都通过网关向前端推送真实进度（替换原模拟进度）。
 *
 * 注意：节点业务逻辑(fetch/analyze/generate)目前仍是占位(mock)，
 * 但执行链路(队列→worker→引擎→逐节点→WS 进度→落库)已是真实闭环，
 * 待 Phase 4/5/6 把节点逻辑写实即可产出真实结果。
 */
@Injectable()
@Processor('workflow')
export class WorkflowConsumer {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly gateway: WorkflowGateway,
  ) {}

  // @nestjs/bullmq v10：方法名 process 即被自动识别为任务处理器（无需 @Process 装饰器）
  async process(job: Job<{ workflowId: string; executionId: string }>): Promise<void> {
    const { workflowId, executionId } = job.data;

    this.gateway.pushProgress(executionId, 'queued', undefined, '工作流已入队，等待 Worker 执行');

    const workflow = await this.workflowService.findOne(workflowId);
    if (!workflow) {
      this.gateway.pushProgress(executionId, 'failed', undefined, '工作流不存在');
      await this.workflowService.updateExecution(executionId, { status: 'failed', error: 'Workflow not found' });
      return;
    }

    // 注册内置节点处理器（占位逻辑，待 Phase 4/5/6 写实）
    registerBuiltinNodes(NodeExecutor);

    const store = new ContextStore();
    const engine = new PipelineEngine(store);

    try {
      const execution = await engine.execute(workflow, undefined, {
        onNodeStart: (node) =>
          this.gateway.pushProgress(executionId, 'node:start', node.id, `开始执行：${node.label || node.type}`),
        onNodeComplete: (result) =>
          this.gateway.pushProgress(
            executionId,
            result.status === 'failed' ? 'node:failed' : 'node:success',
            result.nodeId,
            result.status === 'failed' ? `节点失败：${result.error ?? 'unknown'}` : `节点完成：${result.nodeId}`,
          ),
      });

      await this.workflowService.updateExecution(executionId, {
        status: execution.status,
        progress: execution.progress,
        completedAt: execution.completedAt ? new Date(execution.completedAt) : undefined,
      });

      this.gateway.pushProgress(
        executionId,
        execution.status === 'completed' ? 'completed' : 'failed',
        undefined,
        execution.status === 'completed' ? '工作流执行完成' : `执行失败：${execution.error ?? ''}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.gateway.pushProgress(executionId, 'failed', undefined, `执行异常：${message}`);
      await this.workflowService.updateExecution(executionId, { status: 'failed', error: message });
    }
  }
}
