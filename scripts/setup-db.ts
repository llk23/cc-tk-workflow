// TK AI Video Pipeline — SQL Server 建表脚本

// 注意：此脚本需在 SQL Server Management Studio 或 sqlcmd 中执行
// 数据库初始化也会作为后续开发的一部分

/*
-- 创建数据库
CREATE DATABASE tk_workflow;
GO

USE tk_workflow;
GO

-- 工作流定义表
CREATE TABLE workflows (
    id VARCHAR(64) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000),
    status VARCHAR(20) DEFAULT 'draft',
    trigger_type VARCHAR(20),
    trigger_config NVARCHAR(MAX),
    nodes_json NVARCHAR(MAX),       -- 节点列表（JSON）
    edges_json NVARCHAR(MAX),       -- 边列表（JSON）
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Pipeline 执行记录表
CREATE TABLE pipeline_executions (
    id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress INT DEFAULT 0,
    started_at DATETIME2,
    completed_at DATETIME2,
    error_message NVARCHAR(MAX),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- 视频记录表
CREATE TABLE videos (
    id VARCHAR(64) PRIMARY KEY,
    tk_id VARCHAR(200),
    url NVARCHAR(1000),
    source VARCHAR(50),
    metadata_json NVARCHAR(MAX),
    local_path NVARCHAR(500),
    status VARCHAR(20),
    fetched_at DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- 视频分析结果表
CREATE TABLE video_analyses (
    id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64) NOT NULL,
    quality_score DECIMAL(3,1),
    hook_rating DECIMAL(3,1),
    style_category VARCHAR(100),
    suggestions_json NVARCHAR(MAX),
    tags_json NVARCHAR(MAX),
    model_used VARCHAR(100),
    analyzed_at DATETIME2,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

-- 视频生成任务表
CREATE TABLE generation_tasks (
    id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64),
    analysis_id VARCHAR(64),
    tool VARCHAR(100),
    prompt NVARCHAR(MAX),
    status VARCHAR(20),
    progress INT DEFAULT 0,
    result_url NVARCHAR(1000),
    error_message NVARCHAR(MAX),
    created_at DATETIME2,
    completed_at DATETIME2,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);
*/
