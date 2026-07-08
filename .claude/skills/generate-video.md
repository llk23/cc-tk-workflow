---
name: generate-video
description: AI 视频生成技能 — 基于分析结果调用 AI 视频生成工具
---

# AI 视频生成技能

## 概述
基于 TK 视频分析结果，调用外部 AI 视频生成工具（如 Runway、Pika、Kling、可灵等）生成新视频。

## 配置参数
- `tool`: 视频生成工具类型
- `prompt`: 生成描述（可基于分析结果自动生成）
- `reference_video`: 参考视频路径
- `resolution`: 输出分辨率
- `aspect_ratio`: 画面比例
- `duration`: 视频长度

## 输出
- `task_id`: 生成任务 ID
- `status_url`: 进度查询 URL
- `result_url`: 最终视频下载地址

## 相关节点
`packages/nodes/src/generate/` — AI 视频生成节点实现
