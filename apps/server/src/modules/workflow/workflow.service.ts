import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Workflow, WorkflowStatusEnum } from '@tk-workflow/types';
import { WorkflowEntity } from './entities/workflow.entity';
import { ExecutionEntity } from './entities/execution.entity';
import { AnalysisReport, AnalysisReportDocument } from './schemas/analysis-report.schema';

/**
 * 工作流服务（Phase 3 落库版）
 * - 工作流定义/执行记录 → SQL Server (TypeORM)
 * - 结构化分析报告 → MongoDB
 * - 执行入口改为入队 BullMQ，由 Worker 真实驱动引擎
 */
@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(WorkflowEntity)
    private readonly workflowRepo: Repository<WorkflowEntity>,
    @InjectRepository(ExecutionEntity)
    private readonly executionRepo: Repository<ExecutionEntity>,
    @InjectModel(AnalysisReport.name)
    private readonly analysisReportModel: Model<AnalysisReportDocument>,
    @InjectQueue('workflow') private readonly workflowQueue: Queue,
  ) {}

  // ---------- 工作流定义 ----------

  async create(workflow: Partial<Workflow>): Promise<Workflow> {
    const id = `wf_${Date.now()}`;
    const entity = this.workflowRepo.create({
      id,
      name: workflow.name || '未命名工作流',
      description: workflow.description,
      status: (workflow.status as string) || WorkflowStatusEnum.DRAFT,
      trigger: (workflow.trigger as unknown as Record<string, unknown>) ?? {},
      nodes: (workflow.nodes as unknown[]) ?? [],
      edges: (workflow.edges as unknown[]) ?? [],
    });
    const saved = await this.workflowRepo.save(entity);
    return this.toWorkflow(saved);
  }

  async findAll(): Promise<Workflow[]> {
    const list = await this.workflowRepo.find({ order: { createdAt: 'DESC' } });
    return list.map((e) => this.toWorkflow(e));
  }

  async findOne(id: string): Promise<Workflow | null> {
    const entity = await this.workflowRepo.findOne({ where: { id } });
    return entity ? this.toWorkflow(entity) : null;
  }

  private toWorkflow(e: WorkflowEntity): Workflow {
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      status: (e.status as WorkflowStatusEnum) ?? WorkflowStatusEnum.DRAFT,
      trigger: (e.trigger as any) ?? { type: 'manual' as any },
      nodes: (e.nodes as any) ?? [],
      edges: (e.edges as any) ?? [],
      createdAt: e.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: e.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  // ---------- 执行：入队（真实异步） ----------

  async execute(id: string): Promise<{ executionId: string; status: string; workflowId: string }> {
    const workflow = await this.findOne(id);
    if (!workflow) throw new Error('Workflow not found');

    const executionId = `exec_${Date.now()}`;
    // 落库执行记录（pending）
    await this.executionRepo.save(
      this.executionRepo.create({
        id: executionId,
        workflowId: id,
        status: 'pending',
        progress: 0,
      }),
    );

    // 入队，毫秒返回（真实执行在 Worker 中异步进行）
    await this.workflowQueue.add(
      'run',
      { workflowId: id, executionId },
      { jobId: executionId, removeOnComplete: 100, removeOnFail: 50 },
    );

    return { executionId, status: 'queued', workflowId: id };
  }

  // ---------- 执行记录读写（供 Worker 调用） ----------

  async saveExecution(e: Partial<ExecutionEntity>): Promise<void> {
    await this.executionRepo.save(this.executionRepo.create(e as ExecutionEntity));
  }

  async updateExecution(
    id: string,
    patch: Partial<Pick<ExecutionEntity, 'status' | 'progress' | 'context' | 'error' | 'completedAt'>>,
  ): Promise<void> {
    await this.executionRepo.update(id, patch as any);
  }

  async getExecutionHistory(workflowId: string): Promise<ExecutionEntity[]> {
    return this.executionRepo.find({ where: { workflowId }, order: { startedAt: 'DESC' } });
  }

  // ---------- 分析报告（MongoDB，供 Phase 5 使用） ----------

  async saveAnalysisReport(report: Partial<AnalysisReport>): Promise<void> {
    await this.analysisReportModel.create(report);
  }
}
