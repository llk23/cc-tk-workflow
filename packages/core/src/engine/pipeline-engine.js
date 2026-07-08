"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineEngine = void 0;
const types_1 = require("@tk-workflow/types");
const workflow_graph_1 = require("../graph/workflow-graph");
const executor_1 = require("./executor");
/**
 * Pipeline 执行引擎
 * 负责整个工作流的生命周期管理：从图构建到节点执行再到结果收集
 */
class PipelineEngine {
    graph;
    executor;
    store;
    constructor(store) {
        this.graph = new workflow_graph_1.WorkflowGraph();
        this.executor = new executor_1.NodeExecutor();
        this.store = store;
    }
    /**
     * 加载工作流定义，构建执行图
     */
    loadWorkflow(workflow) {
        this.graph.buildFromWorkflow(workflow);
    }
    /**
     * 执行整个 Pipeline
     * 按拓扑排序依次执行节点
     */
    async execute(workflow, initialConfig) {
        this.loadWorkflow(workflow);
        const execution = {
            id: this.generateId(),
            workflowId: workflow.id,
            status: types_1.ExecutionStatusEnum.RUNNING,
            progress: 0,
            startedAt: new Date().toISOString(),
            context: {
                pipelineId: this.generateId(),
                createdAt: new Date().toISOString(),
                config: initialConfig ?? {},
                nodeResults: {},
                sharedData: {},
                progress: 0,
                status: types_1.ExecutionStatusEnum.RUNNING,
            },
        };
        // 保存初始上下文
        await this.store.saveContext(execution.context);
        try {
            // 拓扑排序获取执行顺序
            const sortedNodes = this.graph.getExecutionOrder();
            for (let i = 0; i < sortedNodes.length; i++) {
                const node = sortedNodes[i];
                const nodeInput = this.collectNodeInput(node.id, execution.context);
                // 执行节点
                const result = await this.executor.executeNode(node, nodeInput);
                // 保存节点执行结果
                execution.context.nodeResults[node.id] = result;
                execution.context.sharedData[`node_${node.id}_output`] = result.output;
                execution.context.progress = Math.round(((i + 1) / sortedNodes.length) * 100);
                execution.progress = execution.context.progress;
                // 更新上下文到 Redis
                await this.store.saveContext(execution.context);
                // 如果节点执行失败，视策略决定是否继续
                if (result.status === 'failed') {
                    execution.status = types_1.ExecutionStatusEnum.FAILED;
                    execution.error = `Node ${node.label} (${node.id}) failed: ${result.error}`;
                    await this.store.saveContext(execution.context);
                    return execution;
                }
            }
            execution.status = types_1.ExecutionStatusEnum.COMPLETED;
            execution.completedAt = new Date().toISOString();
            execution.context.status = types_1.ExecutionStatusEnum.COMPLETED;
            await this.store.saveContext(execution.context);
        }
        catch (err) {
            execution.status = types_1.ExecutionStatusEnum.FAILED;
            execution.error = err instanceof Error ? err.message : 'Unknown pipeline error';
            execution.context.status = types_1.ExecutionStatusEnum.FAILED;
            await this.store.saveContext(execution.context);
        }
        return execution;
    }
    /**
     * 收集节点的输入数据（从前序节点的输出中提取）
     */
    collectNodeInput(nodeId, context) {
        const input = {};
        const edges = this.graph.getIncomingEdges(nodeId);
        for (const edge of edges) {
            const sourceResult = context.nodeResults[edge.source];
            if (sourceResult?.output) {
                input[edge.source] = sourceResult.output;
            }
        }
        return input;
    }
    /**
     * 获取执行进度
     */
    async getProgress(pipelineId) {
        return this.store.getContext(pipelineId);
    }
    /**
     * 取消执行
     */
    async cancel(pipelineId) {
        const context = await this.store.getContext(pipelineId);
        if (context) {
            context.status = types_1.ExecutionStatusEnum.CANCELLED;
            await this.store.saveContext(context);
        }
    }
    generateId() {
        const { v4: uuidv4 } = require('uuid');
        return uuidv4();
    }
}
exports.PipelineEngine = PipelineEngine;
//# sourceMappingURL=pipeline-engine.js.map