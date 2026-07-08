// ==========================================
// 节点库统一导出
// ==========================================

export { BaseNode } from './base/base-node';
export type { NodeDefinition, NodeExecutionContext } from './base/base-node';
export { FetchTKVideoNode } from './fetch';
export { AIAnalyzeVideoNode } from './analyze';
export { VideoGenerateNode } from './generate';
export { TransformNode } from './transform';
export { ConditionNode } from './condition';
export { OutputNode } from './output';

import { NodeExecutor } from '@tk-workflow/core';
import { FetchTKVideoNode } from './fetch';
import { AIAnalyzeVideoNode } from './analyze';
import { VideoGenerateNode } from './generate';
import { TransformNode } from './transform';
import { ConditionNode } from './condition';
import { OutputNode } from './output';
import { NodeExecutionContext } from './base/base-node';

/**
 * 注册所有内置节点到执行引擎
 */
export function registerBuiltinNodes(executor: typeof NodeExecutor): void {
  const nodes = [
    new FetchTKVideoNode(),
    new AIAnalyzeVideoNode(),
    new VideoGenerateNode(),
    new TransformNode(),
    new ConditionNode(),
    new OutputNode(),
  ];

  for (const node of nodes) {
    const def = node.getDefinition();
    executor.registerHandler(def.type, (config, input) => {
      const ctx: NodeExecutionContext = {
        pipelineId: 'pipeline',
        node: { id: '', type: def.type, label: def.label, position: { x: 0, y: 0 }, config },
        logger: (msg: string) => console.log(`[${def.label}] ${msg}`),
        onProgress: (pct: number) => console.log(`[${def.label}] 进度: ${pct}%`),
      };
      return node.execute(config, input, ctx);
    });
  }
}
