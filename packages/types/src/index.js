"use strict";
// ==========================================
// TK AI Video Pipeline — 核心类型定义
// ==========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionStatusEnum = exports.GenerationStatusEnum = exports.VideoStatusEnum = exports.NodeTypeEnum = exports.TriggerTypeEnum = exports.WorkflowStatusEnum = void 0;
// ---- 工作流类型 ----
/** 工作流状态 */
var WorkflowStatusEnum;
(function (WorkflowStatusEnum) {
    WorkflowStatusEnum["DRAFT"] = "draft";
    WorkflowStatusEnum["ACTIVE"] = "active";
    WorkflowStatusEnum["PAUSED"] = "paused";
    WorkflowStatusEnum["ARCHIVED"] = "archived";
})(WorkflowStatusEnum || (exports.WorkflowStatusEnum = WorkflowStatusEnum = {}));
/** 工作流触发方式 */
var TriggerTypeEnum;
(function (TriggerTypeEnum) {
    TriggerTypeEnum["MANUAL"] = "manual";
    TriggerTypeEnum["SCHEDULE"] = "schedule";
    TriggerTypeEnum["WEBHOOK"] = "webhook";
    TriggerTypeEnum["EVENT"] = "event";
})(TriggerTypeEnum || (exports.TriggerTypeEnum = TriggerTypeEnum = {}));
// ---- 节点类型 ----
/** 节点类型枚举 */
var NodeTypeEnum;
(function (NodeTypeEnum) {
    NodeTypeEnum["FETCH_TK"] = "fetch-tk";
    NodeTypeEnum["AI_ANALYZE"] = "ai-analyze";
    NodeTypeEnum["VIDEO_GENERATE"] = "video-generate";
    NodeTypeEnum["TRANSFORM"] = "transform";
    NodeTypeEnum["CONDITION"] = "condition";
    NodeTypeEnum["OUTPUT"] = "output";
    NodeTypeEnum["START"] = "start";
    NodeTypeEnum["END"] = "end";
})(NodeTypeEnum || (exports.NodeTypeEnum = NodeTypeEnum = {}));
/** 视频状态 */
var VideoStatusEnum;
(function (VideoStatusEnum) {
    VideoStatusEnum["PENDING"] = "pending";
    VideoStatusEnum["DOWNLOADING"] = "downloading";
    VideoStatusEnum["DOWNLOADED"] = "downloaded";
    VideoStatusEnum["ANALYZING"] = "analyzing";
    VideoStatusEnum["ANALYZED"] = "analyzed";
    VideoStatusEnum["GENERATING"] = "generating";
    VideoStatusEnum["GENERATED"] = "generated";
    VideoStatusEnum["FAILED"] = "failed";
})(VideoStatusEnum || (exports.VideoStatusEnum = VideoStatusEnum = {}));
/** 生成状态 */
var GenerationStatusEnum;
(function (GenerationStatusEnum) {
    GenerationStatusEnum["QUEUED"] = "queued";
    GenerationStatusEnum["PROCESSING"] = "processing";
    GenerationStatusEnum["COMPLETED"] = "completed";
    GenerationStatusEnum["FAILED"] = "failed";
})(GenerationStatusEnum || (exports.GenerationStatusEnum = GenerationStatusEnum = {}));
/** 执行状态 */
var ExecutionStatusEnum;
(function (ExecutionStatusEnum) {
    ExecutionStatusEnum["PENDING"] = "pending";
    ExecutionStatusEnum["RUNNING"] = "running";
    ExecutionStatusEnum["PAUSED"] = "paused";
    ExecutionStatusEnum["COMPLETED"] = "completed";
    ExecutionStatusEnum["FAILED"] = "failed";
    ExecutionStatusEnum["CANCELLED"] = "cancelled";
})(ExecutionStatusEnum || (exports.ExecutionStatusEnum = ExecutionStatusEnum = {}));
//# sourceMappingURL=index.js.map