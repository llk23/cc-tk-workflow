import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowService {
  private workflows: Map<string, any> = new Map();

  async create(workflow: any) {
    const id = `wf_${Date.now()}`;
    const saved = { ...workflow, id, createdAt: new Date().toISOString() };
    this.workflows.set(id, saved);
    return saved;
  }

  async findAll() {
    return Array.from(this.workflows.values());
  }

  async findOne(id: string) {
    return this.workflows.get(id) ?? null;
  }

  async execute(id: string) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new Error('Workflow not found');
    return { executionId: `exec_${Date.now()}`, status: 'queued', workflowId: id };
  }

  async getExecutionHistory(_id: string) {
    return [];
  }
}
