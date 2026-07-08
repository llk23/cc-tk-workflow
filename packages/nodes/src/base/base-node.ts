// ==========================================
// 节点基类 — 所有工作流节点继承此类
// ==========================================

import { NodeConfig, WorkflowNode, PortDefinition, NodeTypeEnum } from '@tk-workflow/types';

/**
 * 节点执行上下文
 * 节点运行时可以访问的信息
 */
export interface NodeExecutionContext {
  pipelineId: string;
  node: WorkflowNode;
  logger: (msg: string) => void;
  onProgress: (percent: number) => void;
}

/**
 * 节点定义
 * 描述节点的元数据，用于可视化编辑器展示
 */
export interface NodeDefinition {
  type: NodeTypeEnum;
  label: string;
  description: string;
  category: 'input' | 'process' | 'ai' | 'output';
  icon: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  defaultConfig: NodeConfig;
}

/**
 * 节点基类
 * 所有业务节点继承此类，实现 execute 方法
 */
export abstract class BaseNode {
  /** 节点定义（静态元数据） */
  static definition: NodeDefinition;

  /** 执行节点逻辑 */
  abstract execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown>;

  /** 校验节点配置 */
  validateConfig(_config: NodeConfig): string[] {
    return []; // 子类可重写
  }

  /** 获取节点定义 */
  getDefinition(): NodeDefinition {
    return (this.constructor as typeof BaseNode).definition;
  }
}
