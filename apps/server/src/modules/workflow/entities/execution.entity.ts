import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 执行实例实体（持久化到 SQL Server）
 * 记录每次"运行"的状态/进度/上下文，重启可查。
 */
@Entity('executions')
export class ExecutionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  workflowId!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  /** 执行上下文（节点间共享数据），JSON，可空 */
  @Column('simple-json', { nullable: true })
  context?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  error?: string;

  @CreateDateColumn({ type: 'datetime' })
  startedAt!: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
