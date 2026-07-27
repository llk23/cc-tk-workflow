import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowConsumer } from './workflow.consumer';
import { WorkflowEntity } from './entities/workflow.entity';
import { ExecutionEntity } from './entities/execution.entity';
import { AnalysisResultEntity } from './entities/analysis-result.entity';
import { GeneratedVideoEntity } from './entities/generated-video.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowEntity,
      ExecutionEntity,
      AnalysisResultEntity,
      GeneratedVideoEntity,
    ]),
    // 注：MongoDB（分析报告存储）暂未接入。Mongo 仅服务于 Phase 5 分析报告（当前为 mock），
    // 待本地 MongoDB 就绪后再加回 MongooseModule.forFeature([{ name: AnalysisReport.name, schema: AnalysisReportSchema }])。
    BullModule.registerQueue({ name: 'workflow' }),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowGateway, WorkflowConsumer],
  exports: [WorkflowService],
})
export class WorkflowModule {}
