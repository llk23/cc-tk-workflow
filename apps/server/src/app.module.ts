import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { TaskModule } from './modules/task/task.module';
import { VideoModule } from './modules/video/video.module';
import { StorageModule } from './modules/storage/storage.module';
import { WorkflowEntity } from './modules/workflow/entities/workflow.entity';
import { ExecutionEntity } from './modules/workflow/entities/execution.entity';
import { AnalysisResultEntity } from './modules/workflow/entities/analysis-result.entity';
import { GeneratedVideoEntity } from './modules/workflow/entities/generated-video.entity';

@Module({
  imports: [
    // SQL Server：工作流/执行/分析/生成 元数据
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 1433),
      username: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'YourPassword123!',
      database: process.env.DB_NAME || 'tk_workflow',
      entities: [WorkflowEntity, ExecutionEntity, AnalysisResultEntity, GeneratedVideoEntity],
      synchronize: true, // 开发期自动建表
      options: { encrypt: false },
    }),
    // MongoDB：结构化分析报告(嵌套 JSON)
    MongooseModule.forRoot(
      process.env.MONGO_URL || 'mongodb://mongoadmin:mongoadmin@localhost:27017/tk_workflow?authSource=admin',
    ),
    // BullMQ：异步任务队列(Redis 支撑)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
    StorageModule,
    WorkflowModule,
    TaskModule,
    VideoModule,
  ],
})
export class AppModule {}
