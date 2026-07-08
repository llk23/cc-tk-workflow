import { Controller, Get, Param } from '@nestjs/common';
import { TaskService } from './task.service';

@Controller('api/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  async list() {
    return this.taskService.findAll();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.taskService.findOne(id);
  }
}
