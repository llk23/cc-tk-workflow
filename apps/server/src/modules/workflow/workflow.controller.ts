import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.workflowService.findOne(id);
  }

  @Post(':id/execute')
  async execute(@Param('id') id: string) {
    // Phase 3：入队 BullMQ，由 Worker 真实驱动引擎并推送进度
    return this.workflowService.execute(id);
  }

  @Get(':id/history')
  async history(@Param('id') id: string) {
    return this.workflowService.getExecutionHistory(id);
  }
}
