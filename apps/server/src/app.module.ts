import { Module } from '@nestjs/common';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { TaskModule } from './modules/task/task.module';
import { VideoModule } from './modules/video/video.module';

@Module({
  imports: [WorkflowModule, TaskModule, VideoModule],
})
export class AppModule {}
