---
name: analyze-video
description: AI 视频分析技能 — 使用多模态 AI 模型分析 TK 视频内容
---

# AI 视频分析技能

## 概述
使用支持视频/多模态的大语言模型（如 GPT-4o、Claude Sonnet）对 TK 视频进行深度分析。

## 分析维度
- **内容质量评分** (1-10)
- **视觉风格分类** (教程/搞笑/展示/剧情/才艺)
- **前3秒吸引力评分** (Hook Rating)
- **文案结构分析** (AIDA/PAS/其他)
- **音乐/音效分析** (风格匹配度、节奏感)
- **目标受众预测**
- **优化建议**

## Provider 配置
通过 `packages/providers` 统一接口调用，支持模型切换。
当前支持的 Provider：
- OpenAI (GPT-4o, GPT-4o-mini)
- Claude (Claude Sonnet)
- Ollama (本地模型，用于测试)

## 相关节点
`packages/nodes/src/analyze/` — AI 视频分析节点实现

## 示例 Prompt
```
请分析这个 TK 短视频，关注：
1. 前3秒吸引力评分 (1-10)
2. 视觉风格分类
3. 文案结构
4. 音乐氛围
5. 给出 3 条具体优化建议
```
