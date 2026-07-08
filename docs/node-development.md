# 如何开发新节点

## 步骤

1. 在 `packages/nodes/src/` 下创建目录，如 `my-node/`
2. 继承 `BaseNode` 类
3. 实现 `execute` 方法
4. 定义 `static definition`（节点元数据）
5. 在 `packages/nodes/src/index.ts` 中导出并注册

## 示例

```typescript
import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';

export class MyNode extends BaseNode {
  static definition: NodeDefinition = {
    type: 'my-custom-type' as NodeTypeEnum,
    label: '我的节点',
    description: '描述',
    category: 'process',
    icon: '🔧',
    inputs: [{ id: 'in', name: '输入', type: 'any', required: true }],
    outputs: [{ id: 'out', name: '输出', type: 'any', required: true }],
    defaultConfig: { key: 'value' },
  };

  async execute(config: NodeConfig, input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    ctx.logger('开始执行自定义逻辑');
    ctx.onProgress(50);
    // ... 业务逻辑
    ctx.onProgress(100);
    return { result: 'success' };
  }
}
```

## 注册

在 `packages/nodes/src/index.ts` 的 `registerBuiltinNodes` 中添加一行即可。
