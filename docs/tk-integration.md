# TK 平台对接说明

## 数据源接入

当前支持的数据源类型：

| 类型 | 说明 | 认证方式 | 状态 |
|------|------|---------|------|
| TikAPI | 第三方 TK 数据 API | API Key | 🔜 待接入 |
| TikAnalytics | TK 分析网站 | Cookie/Token | 🔜 待接入 |
| 直接爬取 | 浏览器自动化 | 无 | 🔜 待接入 |

## 接入方式

对接入 `packages/nodes/src/fetch/` 中的逻辑，按实际 API 文档实现即可。
