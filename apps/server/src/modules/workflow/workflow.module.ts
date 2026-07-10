import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowConsumer } from './workflow.consumer';
import { WorkflowEntity } from './entities/workflow.entity';
import { ExecutionEntity } from './entities/execution.entity';
import { AnalysisResultEntity } from './entities/analysis-result.entity';
import { GeneratedVideoEntity } from './entities/generated-video.entity';
import { AnalysisReport, AnalysisReportSchema } from './schemas/analysis-report.schema';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowEntity,
      ExecutionEntity,
      AnalysisResultEntity,
      GeneratedVideoEntity,
    ]),
    MongooseModule.forFeature([{ name: AnalysisReport.name, schema: AnalysisReportSchema }]),
    BullModule.registerQueue({ name: 'workflow' }),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowGateway, WorkflowConsumer],
  exports: [WorkflowService],
})
export class WorkflowModule {}
