import { Workflow, PipelineExecution, ExecutionContext } from '@tk-workflow/types';
import { ContextStore } from '../storage/context-store';
/**
 * Pipeline 执行引擎
 * 负责整个工作流的生命周期管理：从图构建到节点执行再到结果收集
 */
export declare class PipelineEngine {
    private graph;
    private executor;
    private store;
    constructor(store: ContextStore);
    /**
     * 加载工作流定义，构建执行图
     */
    loadWorkflow(workflow: Workflow): void;
    /**
     * 执行整个 Pipeline
     * 按拓扑排序依次执行节点
     */
    execute(workflow: Workflow, initialConfig?: Record<string, unknown>): Promise<PipelineExecution>;
    /**
     * 收集节点的输入数据（从前序节点的输出中提取）
     */
    private collectNodeInput;
    /**
     * 获取执行进度
     */
    getProgress(pipelineId: string): Promise<ExecutionContext | null>;
    /**
     * 取消执行
     */
    cancel(pipelineId: string): Promise<void>;
    private generateId;
}
//# sourceMappingURL=pipeline-engine.d.ts.map