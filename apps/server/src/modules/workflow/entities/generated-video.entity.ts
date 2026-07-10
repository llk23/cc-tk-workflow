import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * AI 生成视频记录（SQL Server 元数据层）
 * 生成的视频文件本身存对象存储(MinIO)，这里只存元数据与结果 URL。
 */
@Entity('generated_videos')
export class GeneratedVideoEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  videoId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  analysisId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tool?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  prompt?: string;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  resultUrl?: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  error?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
