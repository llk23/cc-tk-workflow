/** 工作流状态 */
export declare enum WorkflowStatusEnum {
    DRAFT = "draft",
    ACTIVE = "active",
    PAUSED = "paused",
    ARCHIVED = "archived"
}
/** 工作流触发方式 */
export declare enum TriggerTypeEnum {
    MANUAL = "manual",
    SCHEDULE = "schedule",
    WEBHOOK = "webhook",
    EVENT = "event"
}
/** 工作流定义 */
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    status: WorkflowStatusEnum;
    trigger: TriggerConfig;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    createdAt: string;
    updatedAt: string;
}
/** 触发器配置 */
export interface TriggerConfig {
    type: TriggerTypeEnum;
    cron?: string;
    webhookUrl?: string;
    eventFilter?: Record<string, unknown>;
}
/** 节点类型枚举 */
export declare enum NodeTypeEnum {
    FETCH_TK = "fetch-tk",
    AI_ANALYZE = "ai-analyze",
    VIDEO_GENERATE = "video-generate",
    TRANSFORM = "transform",
    CONDITION = "condition",
    OUTPUT = "output",
    START = "start",
    END = "end"
}
/** 节点定义 */
export interface WorkflowNode {
    id: string;
    type: NodeTypeEnum;
    label: string;
    position: {
        x: number;
        y: number;
    };
    config: NodeConfig;
    inputs?: PortDefinition[];
    outputs?: PortDefinition[];
}
/** 节点配置（每个节点类型有自己的配置结构） */
export interface NodeConfig {
    [key: string]: unknown;
}
/** 端口定义（节点输入/输出） */
export interface PortDefinition {
    id: string;
    name: string;
    type: 'video' | 'metadata' | 'analysis' | 'any';
    required: boolean;
    description?: string;
}
/** 边定义（节点间连线） */
export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourcePort?: string;
    targetPort?: string;
    label?: string;
    condition?: EdgeCondition;
}
/** 边的条件（条件分支） */
export interface EdgeCondition {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
    value: unknown;
}
/** TK 视频元数据 */
export interface TKVideo {
    id: string;
    url: string;
    downloadUrl?: string;
    platform: 'tiktok' | 'tikianalytics' | 'other';
    metadata: VideoMetadata;
    localPath?: string;
    status: VideoStatusEnum;
    fetchedAt: string;
}
/** 视频元数据 */
export interface VideoMetadata {
    plays: number;
    likes: number;
    comments: number;
    shares: number;
    duration: number;
    author: string;
    description: string;
    hashtags: string[];
    musicTitle?: string;
    resolution?: string;
}
/** 视频状态 */
export declare enum VideoStatusEnum {
    PENDING = "pending",
    DOWNLOADING = "downloading",
    DOWNLOADED = "downloaded",
    ANALYZING = "analyzing",
    ANALYZED = "analyzed",
    GENERATING = "generating",
    GENERATED = "generated",
    FAILED = "failed"
}
/** AI 视频分析结果 */
export interface VideoAnalysis {
    videoId: string;
    qualityScore: number;
    hookRating: number;
    styleCategory: string;
    captionStructure?: string;
    audioAnalysis?: AudioAnalysis;
    targetAudience?: string[];
    suggestions: string[];
    generatedTags: string[];
    rawOutput?: string;
    analyzedAt: string;
    modelUsed: string;
}
/** 音频分析 */
export interface AudioAnalysis {
    bgmMood: string;
    rhythmScore: number;
    musicMatchScore: number;
}
/** 视频生成任务 */
export interface VideoGenerationTask {
    id: string;
    videoId: string;
    analysisId?: string;
    tool: string;
    prompt: string;
    referenceVideo?: string;
    status: GenerationStatusEnum;
    progress: number;
    resultUrl?: string;
    error?: string;
    createdAt: string;
    completedAt?: string;
}
/** 生成状态 */
export declare enum GenerationStatusEnum {
    QUEUED = "queued",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
/** Pipeline 执行实例 */
export interface PipelineExecution {
    id: string;
    workflowId: string;
    status: ExecutionStatusEnum;
    context: ExecutionContext;
    progress: number;
    startedAt: string;
    completedAt?: string;
    error?: string;
}
/** 执行状态 */
export declare enum ExecutionStatusEnum {
    PENDING = "pending",
    RUNNING = "running",
    PAUSED = "paused",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
/** 执行上下文（节点间共享数据） */
export interface ExecutionContext {
    pipelineId: string;
    createdAt: string;
    config: Record<string, unknown>;
    nodeResults: Record<string, NodeResult>;
    sharedData: Record<string, unknown>;
    progress: number;
    status: ExecutionStatusEnum;
}
/** 单个节点执行结果 */
export interface NodeResult {
    nodeId: string;
    status: 'success' | 'failed' | 'skipped';
    input?: unknown;
    output?: unknown;
    error?: string;
    startedAt: string;
    completedAt: string;
    duration: number;
    retries: number;
}
//# sourceMappingURL=index.d.ts.map