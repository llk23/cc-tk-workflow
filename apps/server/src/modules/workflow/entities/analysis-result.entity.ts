import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * 视频分析结果（元数据层，SQL Server）
 * 详细的结构化报告(JSON)存 MongoDB（见 AnalysisReport schema）；
 * 此表存可检索的摘要字段，便于列表/统计。
 */
@Entity('analysis_results')
export class AnalysisResultEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  videoId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  workflowId?: string;

  @Column({ type: 'float', nullable: true })
  qualityScore?: number;

  @Column({ type: 'float', nullable: true })
  hookRating?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  styleCategory?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  modelUsed?: string;

  /** 完整原始输出(JSON)，可空 */
  @Column('simple-json', { nullable: true })
  rawOutput?: Record<string, unknown>;

  @CreateDateColumn({ type: 'datetime' })
  analyzedAt!: Date;
}
