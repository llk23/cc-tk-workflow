import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { Workflow } from '@tk-workflow/types';

@Controller('api/workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  async create(@Body() workflow: Workflow) {
    return this.workflowService.create(workflow);
  }

  @Get()
  async list() {
    return this.workflowService.findAll();
  }

  // 跨工作流记录汇总（含调试记录），供「记录」面板使用
  @Get('records')
  async records() {
    return this.workflowService.getAllRecords();
  }

  // 删除单条执行记录（运行或调试记录）
  @Delete('records/:execId')
  async removeRecord(@Param('execId') execId: string) {
    return this.workflowService.removeExecution(execId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.workflowService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() workflow: Partial<Workflow>) {
    return this.workflowService.update(id, workflow);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.workflowService.remove(id);
    return { ok: true, id };
  }

  @Post(':id/execute')
  async execute(@Param('id') id: string) {
    // Phase 3：入队 BullMQ，由 Worker 真实驱动引擎并推送进度
    return this.workflowService.execute(id);
  }

  // 单节点隔离调试：只运行指定节点（用空输入），返回输出与日志，便于按需排错
  @Post(':id/debug')
  async debug(@Param('id') id: string, @Body() body: { nodeId: string }) {
    return this.workflowService.debugNode(id, body?.nodeId);
  }

  @Get(':id/history')
  async history(@Param('id') id: string, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.workflowService.getExecutionHistory(id, isNaN(n) ? 20 : Math.min(n, 100));
  }

  // 单条执行完整记录（含完整 rawOutput，供报告全文弹窗使用）
  @Get(':id/history/:execId')
  async historyOne(@Param('id') id: string, @Param('execId') execId: string) {
    return this.workflowService.getExecutionById(id, execId);
  }

  // 保存某次分析结果的编辑（如修改 generationPrompt）
  @Put(':id/history/:execId/analysis')
  async updateAnalysis(
    @Param('id') id: string,
    @Param('execId') execId: string,
    @Body() body: { nodeId: string; videoIdx: number; prompt: string },
  ) {
    return this.workflowService.updateAnalysisPrompt(id, execId, body.nodeId, body.videoIdx, body.prompt);
  }
}
