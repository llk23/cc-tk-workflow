import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * 视频分析详细报告（MongoDB）
 * 存放结构不固定的大坨嵌套 JSON：画面/节奏/文案/BGM/爆款元素/生成指令。
 * 这类文档用 Mongo 比 SQL 表格更合适。
 */
@Schema({ timestamps: true, collection: 'analysis_reports' })
export class AnalysisReport {
  @Prop({ required: true, index: true })
  executionId!: string;

  @Prop({ index: true })
  videoId?: string;

  @Prop({ index: true })
  workflowId?: string;

  /** 画面内容识别 */
  @Prop({ type: Object })
  visual?: Record<string, unknown>;

  /** 镜头节奏拆解 */
  @Prop({ type: Object })
  pacing?: Record<string, unknown>;

  /** 文案结构与钩子技巧 */
  @Prop({ type: Object })
  script?: Record<string, unknown>;

  /** BGM 识别与情绪匹配 */
  @Prop({ type: Object })
  bgm?: Record<string, unknown>;

  /** 爆款元素标注（反转点/互动引导等） */
  @Prop({ type: Object })
  viralElements?: Record<string, unknown>;

  /** 可直接喂给生成模块的指令 */
  @Prop({ type: Object })
  generationPrompt?: Record<string, unknown>;
}

export type AnalysisReportDocument = HydratedDocument<AnalysisReport>;
export const AnalysisReportSchema = SchemaFactory.createForClass(AnalysisReport);
