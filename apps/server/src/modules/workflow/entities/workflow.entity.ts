import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 工作流定义实体（持久化到 SQL Server）
 * 替代原 workflow.service 中的内存 Map，重启不丢。
 */
@Entity('workflows')
export class WorkflowEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: string;

  /** 触发器配置（cron/webhook/event），JSON */
  @Column('simple-json', { nullable: true })
  trigger!: Record<string, unknown>;

  /** 节点定义列表，JSON */
  @Column('simple-json')
  nodes!: unknown[];

  /** 边定义列表，JSON */
  @Column('simple-json')
  edges!: unknown[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
