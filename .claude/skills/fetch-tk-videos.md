---
name: fetch-tk-videos
description: TK 视频抓取技能 — 配置和执行 TikTok 视频数据抓取
---

# TK 视频抓取技能

## 概述
从 TikTok 平台或第三方 TK 数据分析平台（如 TikAPI、TikAnalytics）获取视频数据。

## 数据源配置
当前支持的抓取方式：
1. **TikAPI** — 通过第三方 API 获取 TK 视频数据（需要 API Key）
2. **TikAnalytics** — 通过分析网站接口获取数据（需要 cookies/认证）
3. **直接爬取** — 基于 puppeteer/playwright 的浏览器自动化

## 配置参数
- `source`: 数据源类型
- `keyword`: 搜索关键词/hashtag
- `count`: 抓取数量
- `filters`: 播放量、点赞数等过滤条件
- `auto_download`: 是否自动下载视频文件

## 输出数据
```
{
  videos: [{
    id, url, download_url,
    metadata: { plays, likes, comments, shares },
    local_path
  }]
}
```

## 相关节点
`packages/nodes/src/fetch/` — TK 视频抓取节点实现
