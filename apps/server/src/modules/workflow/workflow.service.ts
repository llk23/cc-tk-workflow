import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Workflow, WorkflowStatusEnum, NodeTypeEnum } from '@tk-workflow/types';
import {
  FetchTKPlaywrightNode,
  TikTokAccountVerifyNode,
  ModelConfigNode,
  SkillConfigNode,
  AIAnalyzeVideoNode,
  SeedanceAnalyzeNode,
  WorkbuddyAgentAnalyzeNode,
  VideoGenerateNode,
  TransformNode,
  ConditionNode,
  OutputNode,
  type NodeExecutionContext,
  type BaseNode,
} from '@tk-workflow/nodes';
import { WorkflowEntity } from './entities/workflow.entity';
import { ExecutionEntity } from './entities/execution.entity';

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

  async update(id: string, patch: Partial<Workflow>): Promise<Workflow> {
    const existing = await this.workflowRepo.findOne({ where: { id } });
    if (!existing) throw new Error('Workflow not found: ' + id);
    this.workflowRepo.merge(existing, {
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      status: (patch.status as string) ?? existing.status,
      trigger: (patch.trigger as unknown as Record<string, unknown>) ?? existing.trigger,
      nodes: (patch.nodes as unknown[]) ?? existing.nodes,
      edges: (patch.edges as unknown[]) ?? existing.edges,
    });
    const saved = await this.workflowRepo.save(existing);
    return this.toWorkflow(saved);
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
    patch: Partial<
      Pick<ExecutionEntity, 'status' | 'progress' | 'context' | 'error' | 'completedAt' | 'result'>
    >,
  ): Promise<void> {
    await this.executionRepo.update(id, patch as any);
  }

  /**
   * 执行历史（列表用，轻量）
   * - 默认取最近 20 条（可 limit 覆盖）
   * - SQL 层用 SUBSTRING 截断 result 大字段（单条最多 500KB），避免 17MB 级巨型报告
   *   全量传输导致接口耗时十几秒
   * - 巨型记录（截断后 JSON 解析失败）标记 _truncatedRecord=true，前端点击批次时
   *   按需调 getExecutionById 加载完整记录
   */
  async getExecutionHistory(workflowId: string, limit = 20): Promise<any[]> {
    const n = Math.max(1, Math.min(limit, 100));
    const rows: any[] = await this.executionRepo.query(
      `SELECT id, [workflowId], status, progress, error, startedAt, completedAt,
              SUBSTRING(CONVERT(nvarchar(max), result), 1, 500000) AS result_trunc,
              LEN(CONVERT(nvarchar(max), result)) AS result_len
       FROM executions
       WHERE [workflowId] = @0
       ORDER BY startedAt DESC
       OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`,
      [workflowId],
    );

    return (rows || []).map((r: any) => {
      const base = {
        id: r.id,
        workflowId: r.workflowId,
        status: r.status,
        progress: r.progress,
        error: r.error,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        resultLength: Number(r.result_len) || 0,
      };
      let parsed: Record<string, unknown> = {};
      let ok = false;
      if (r.result_trunc) {
        try {
          parsed = JSON.parse(r.result_trunc);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        // 巨型记录：截断的 JSON 解析失败，标记让前端按需加载完整
        return { ...base, result: {}, _truncatedRecord: true };
      }
      return { ...base, result: this.summarizeResult(parsed) };
    });
  }

  /** 单条执行完整记录（含完整 rawOutput，供查看报告全文） */
  async getExecutionById(workflowId: string, execId: string): Promise<ExecutionEntity | null> {
    return this.executionRepo.findOne({ where: { id: execId, workflowId } });
  }

  /** 摘要化 result：截断 analyses 的 rawOutput，保留元数据与长度 */
  private summarizeResult(result: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = {};
    for (const [nodeId, out] of Object.entries(result || {})) {
      if (out && typeof out === 'object' && Array.isArray((out as any).analyses)) {
        const o = { ...(out as any) } as any;
        o.analyses = ((out as any).analyses || []).map((a: any) => {
          const { rawOutput, ...rest } = a || {};
          return {
            ...rest,
            rawOutput: String(rawOutput || '').slice(0, 800),
            rawOutputLength: String(rawOutput || '').length,
            _truncated: String(rawOutput || '').length > 800,
          };
        });
        clone[nodeId] = o;
      } else {
        clone[nodeId] = out;
      }
    }
    return clone;
  }

  // ---------- 跨工作流记录汇总（含调试记录），供「记录」面板使用 ----------
  async getAllRecords(limit = 200): Promise<
    Array<{
      id: string
      workflowId: string
      workflowName: string
      kind: 'run' | 'debug'
      status: string
      progress: number
      error?: string | null
      startedAt?: Date
      completedAt?: Date | null
      nodes: Array<{ nodeId: string; type: string; summary: string }>
      result: Record<string, unknown>
    }>
  > {
    const [execs, workflows] = await Promise.all([
      this.executionRepo.find({ order: { startedAt: 'DESC' }, take: limit }),
      this.workflowRepo.find(),
    ]);
    const nameMap = new Map(workflows.map((w) => [w.id, w.name]));

    return execs.map((e) => {
      const result = (e.result || {}) as Record<string, unknown>;
      // 提取每个节点的输出摘要
      const nodes: Array<{ nodeId: string; type: string; summary: string }> = [];
      for (const [nodeId, output] of Object.entries(result)) {
        const o = output as any;
        const type = o?.config?.type
          || (typeof nodeId === 'string' && nodeId.includes('_') ? nodeId.split('_')[0] : nodeId);
        let summary = '完成';
        if (o && typeof o === 'object') {
          if (Array.isArray(o.videos)) summary = `抓到 ${o.videos.length} 条视频`;
          else if (Array.isArray(o.analyses)) summary = `分析 ${o.analyses.length} 条视频`;
          else if (o.success === true) summary = '成功';
          else if (o.success === false) summary = '失败';
        }
        nodes.push({ nodeId, type, summary });
      }
      return {
        id: e.id,
        workflowId: e.workflowId,
        workflowName: nameMap.get(e.workflowId) || e.workflowId,
        kind: e.id.startsWith('debug_') ? 'debug' : 'run',
        status: e.status,
        progress: e.progress,
        error: e.error,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        nodes,
        result,
      };
    });
  }

  // ---------- 删除单条执行记录 ----------
  async removeExecution(execId: string): Promise<{ ok: boolean }> {
    await this.executionRepo.delete(execId);
    return { ok: true };
  }

  // ---------- 保存某次分析结果的编辑 ----------
  async updateAnalysisPrompt(
    workflowId: string,
    execId: string,
    nodeId: string,
    videoIdx: number,
    prompt: string,
  ): Promise<{ ok: boolean }> {
    const exec = await this.executionRepo.findOne({ where: { id: execId, workflowId } });
    if (!exec) throw new Error('Execution not found');

    const result = (exec.result || {}) as Record<string, any>;
    const nodeOutput = result[nodeId];
    if (!nodeOutput?.analyses?.[videoIdx]) throw new Error('Analysis not found');

    // 更新该视频分析的 rawOutput 中的 generationPrompt
    const analysis = nodeOutput.analyses[videoIdx];
    if (analysis.rawOutput) {
      try {
        const parsed = JSON.parse(analysis.rawOutput);
        if (!parsed.replication) parsed.replication = {};
        parsed.replication.generationPrompt = prompt;
        analysis.rawOutput = JSON.stringify(parsed);
      } catch {
        analysis.rawOutput = prompt;
      }
    }

    await this.executionRepo.update(execId, { result });
    return { ok: true };
  }

  // ---------- 删除：工作流定义 + 其所有执行记录 ----------
  async remove(id: string): Promise<void> {
    await this.executionRepo.delete({ workflowId: id });
    await this.workflowRepo.delete(id);
  }

  // ---------- 单节点隔离调试（先跑上游节点，再跑目标节点） ----------
  async debugNode(
    workflowId: string,
    nodeId: string,
  ): Promise<{ nodeId: string; type: string; output: unknown; logs: string[] }> {
    const workflow = await this.findOne(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    const raw = (workflow.nodes || []).find((n) => n.id === nodeId);
    if (!raw) throw new Error('Node not found: ' + nodeId);

    const logs: string[] = [];
    const ctx: NodeExecutionContext = {
      pipelineId: 'debug',
      node: raw as any,
      logger: (m: string) => logs.push(m),
      onProgress: (p: number) => logs.push(`进度 ${p}%`),
    };

    // 先跑上游节点，将输出作为本节点的输入
    const upstreamLogger = (m: string) => logs.push(m);
    const input = await this.executeUpstreamNodes(workflow, nodeId, upstreamLogger);

    const inst = this.createNodeInstance(raw.type);
    if (!inst) throw new Error('No handler for node type: ' + raw.type);

    const output = await inst.execute(raw.config || {}, input, ctx);

    // 将调试结果保存到执行历史，供前端历史面板读取
    try {
      const execId = 'debug_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await this.executionRepo.save({
        id: execId,
        workflowId,
        status: 'completed',
        result: { [nodeId]: output },
        startedAt: new Date(),
        completedAt: new Date(),
        progress: 100,
      });
    } catch { /* 历史记录保存失败不影响调试主流程 */ }

    return { nodeId, type: raw.type, output, logs };
  }

  /** 递归执行上游节点，收集输出作为下游节点的 input */
  private async executeUpstreamNodes(
    workflow: Workflow,
    nodeId: string,
    log: (msg: string) => void,
  ): Promise<any> {
    const edges = (workflow.edges || []).filter((e) => e.target === nodeId);
    if (edges.length === 0) return undefined;

    // 收集所有上游节点的输出
    const upstreamOutputs: Record<string, any> = {};
    for (const edge of edges) {
      const upstreamNode = (workflow.nodes || []).find((n) => n.id === edge.source);
      if (!upstreamNode) continue;

      // 递归执行上游节点的上游（处理链式连接）
      const upstreamInput = await this.executeUpstreamNodes(workflow, upstreamNode.id, log);

      const inst = this.createNodeInstance(upstreamNode.type);
      if (!inst) {
        log(`  [上游] ${upstreamNode.label || upstreamNode.type}: 无处理器，跳过`);
        continue;
      }

      log(`[上游] ${upstreamNode.label || upstreamNode.type}: 执行`);
      const nodeCtx: NodeExecutionContext = {
        pipelineId: 'debug',
        node: upstreamNode as any,
        logger: (m) => log(`  [${upstreamNode.label || upstreamNode.type}] ${m}`),
        onProgress: (p) => log(`  [${upstreamNode.label || upstreamNode.type}] 进度 ${p}%`),
      };
      const result = await inst.execute(upstreamNode.config || {}, upstreamInput, nodeCtx);

      if (result && typeof result === 'object') {
        // 特殊处理：模型配置节点输出包装为 modelConfig，skill 节点输出包装为 skill
        // （保留对象结构，供下游 inputObj.modelConfig / inputObj.skill 读取）
        if (upstreamNode.type === NodeTypeEnum.MODEL_CONFIG) {
          upstreamOutputs.modelConfig = result;
        } else if (upstreamNode.type === NodeTypeEnum.SKILL_CONFIG) {
          upstreamOutputs.skill = result;
        } else {
          // 其他节点：按 source id 存入，下游可通过视频数据遍历
          upstreamOutputs[edge.source] = result;
        }
      }
    }

    // 单上游：直接返回其输出；多上游：合并后返回
    const keys = Object.keys(upstreamOutputs);
    if (keys.length === 0) return undefined;
    if (keys.length === 1) return upstreamOutputs[keys[0]];
    // 多上游合并：modelConfig/skill 保留对象结构，其余拆解平铺到根
    const merged: Record<string, any> = {};
    for (const [key, output] of Object.entries(upstreamOutputs)) {
      if (key === 'modelConfig' || key === 'skill') {
        merged[key] = output;
      } else if (output && typeof output === 'object' && !Array.isArray(output)) {
        Object.assign(merged, output);
      } else {
        merged[key] = output;
      }
    }
    return merged;
  }

  /** 按节点类型实例化节点（用于隔离调试） */
  private createNodeInstance(type: string): BaseNode | null {
    switch (type) {
      case NodeTypeEnum.FETCH_TK_PLAYWRIGHT:
        return new FetchTKPlaywrightNode();
      case NodeTypeEnum.TK_ACCOUNT_VERIFY:
        return new TikTokAccountVerifyNode();
      case NodeTypeEnum.MODEL_CONFIG:
        return new ModelConfigNode();
      case NodeTypeEnum.SKILL_CONFIG:
        return new SkillConfigNode();
      case NodeTypeEnum.AI_ANALYZE:
        return new AIAnalyzeVideoNode();
      case NodeTypeEnum.AI_ANALYZE_SEEDANCE:
        return new SeedanceAnalyzeNode();
      case NodeTypeEnum.AI_ANALYZE_WORKBUDDY_AGENT:
        return new WorkbuddyAgentAnalyzeNode();
      case NodeTypeEnum.VIDEO_GENERATE:
        return new VideoGenerateNode();
      case NodeTypeEnum.TRANSFORM:
        return new TransformNode();
      case NodeTypeEnum.CONDITION:
        return new ConditionNode();
      case NodeTypeEnum.OUTPUT:
        return new OutputNode();
      default:
        return null;
    }
  }
}
