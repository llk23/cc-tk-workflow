# 需求：工作流节点架构重构 —— 能力拆分（Agent 配置 / Skill 选择 / 视频分析）

> 来源：2026-08-06 对话（skill 测试后的架构反思，第二次修订）
> 用途：供开发对话展开实现
> 状态：方案已评估可行，待开发

## 一、背景与动机

### 原始需求（用户原话）
最初想要的效果是：**skill 测试用的节点链路**。但实现过程中发现重大过错——又违背了"节点职责单一"的初想，把一堆东西塞进一个节点了。

**不需要新做一个节点**，正确做法是：
1. 把 WorkBuddy CLI 配置（cliPath/nodePath/model/permissionMode/workingDir）**放进模型配置节点**
2. 把项目中已安装的 skill **用节点形式展示出来**（自动列出，不同 skill 效果不同）
3. 视频分析节点只保留一个**分析要求模板**（默认模板 + 用户可自由修改）
4. 这样 **sd 节点（ai-analyze-seedance）就不再需要了**——skill 节点选 `seedance-2.0-main` 即等价效果

### 现状问题
当前 `ai-analyze-workbuddy-agent` 节点把以下能力全部耦合在一个节点里：
- CLI 路径 / Node 路径 / 工作目录
- 模型选择
- 权限模式
- 是否使用项目 skill 的开关
- 分析要求模板

且 `ai-analyze-seedance`（sd 节点）与 agent 节点功能重叠——sd 节点读 SKILL.md 直调 API，agent 节点调 CLI 让 Agent 自主用 skill，两者本质是同一能力的两种实现。

### 目标（本次重构）
```
模型配置节点（扩展，含 Agent 配置）
        │ modelConfig（cliPath/nodePath/model/permissionMode/workingDir）
        ▼
Skill 配置节点 ──► skill（name/content）──► 视频分析节点 ──► 分析结果
        ▲
项目中已安装的 skills（自动列出，含 seedance-2.0-main）
```

**删除**：`ai-analyze-seedance`（sd 节点）——skill 节点选 seedance skill 完全替代。
**改造**：`ai-analyze-workbuddy-agent` → 通用视频分析节点（只留分析模板，配置全部读上游）。
**后续价值**：不只是视频分析——以后任何 Agent 任务（写文案、分析数据、生成内容）都能用"模型配置 + skill 选择"这条通用链路，让 Agent 发挥其他能力。

## 二、目标架构（三个节点）

### 节点 1：模型配置节点（扩展现有 model-config）
**职责**：配置两套能力——OpenAI 兼容直调（保留现有）+ WorkBuddy Agent 运行时。

| 配置项 | 说明 |
|---|---|
| apiBaseUrl / apiKey / model | 保留现有 OpenAI 兼容配置（直调场景用） |
| cliPath | WorkBuddy CLI 路径（自动探测，可手填） |
| nodePath | Node 可执行路径（自动探测，可手填） |
| model（agent 用） | Agent 调用的模型（复用 model 字段即可） |
| permissionMode | 权限模式（默认 bypassPermissions） |
| workingDir | Agent 工作目录（默认项目根，用于发现 skills） |

**⚠️ 校验逻辑必须改条件校验**：现有 execute 强制 apiBaseUrl/apiKey/model 三件套必填。Agent 场景不需要 apiBaseUrl/apiKey，只填 cliPath 等 agent 字段时不应报错。规则：**agent 字段（cliPath）填了就放行 Agent 场景；OpenAI 三件套填了就放行直调场景；至少满足其一**。

**输出**：`modelConfig` 对象（含以上所有字段），供下游节点读取。

### 节点 2：Skill 配置节点（新增）
**职责**：自动列出项目中已安装的 skills，让用户选择本次任务用哪个技能。**不同的 skill 效果不同**（seedance 出视频复刻提示词、其他 skill 干其他活）。

| 功能 | 说明 |
|---|---|
| 自动扫描 | 后端接口扫描项目 `.claude/skills/` 目录，读取每个 skill 的 SKILL.md frontmatter（name / description） |
| 下拉展示 | 前端下拉展示所有 skill（含描述），支持多选或单选 |
| 加载内容 | 选中后读取该 skill 的 SKILL.md 内容，随节点输出传给下游 |
| 代表性 skill | `seedance-2.0-main`（根+28子skill）、`seedance-prompt-zh` 等应能直接列出 |

**⚠️ 扫描必须兼容两种形态**：
- 目录型：`seedance-2.0-main/SKILL.md`
- 单文件型：`seedance-prompt-zh.md`（直接放在 skills/ 下的 .md）

**输出**：`skill` 对象：`{ name, path, content, description }`（content 为 SKILL.md 全文，供下游注入）。

### 节点 3：视频分析节点（改造现有 ai-analyze-workbuddy-agent）
**职责**：通用视频分析，自身只保留一个可编辑的分析要求模板。

| 功能 | 说明 |
|---|---|
| 输入 | 上游 `videos`（视频数据）+ `modelConfig`（模型配置）+ `skill`（skill 配置） |
| 分析模板 | 节点内置默认模板（视频分析报告 + Seedance 复刻提示词），用户可自由编辑（textarea） |
| 执行 | 读上游 modelConfig 调起 WorkBuddy CLI，把 skill 内容 + 用户模板拼进 prompt，Agent 自主分析 |
| 输出 | 保持 analyses 结构（含 rawOutput / modelUsed），历史记录可展开 |

**移除**：cliPath / nodePath / model / permissionMode / workingDir / useSeedanceSkill 等配置项（全部由上游模型配置节点提供）。

## 三、后端接口需求

### 新增：Skill 列表接口
```
GET/POST /api/skills
返回：[{ name, path, description }]
```
- 扫描项目根 `.claude/skills/` 下每个子目录/文件
- 目录型读 `<dir>/SKILL.md` 的 frontmatter；单文件型读 `<dir>/<file>.md` 的 frontmatter
- 无 frontmatter 的用文件名兜底
- 过滤隐藏项（如以 `.` 开头的）
- 支持 `?path=xxx` 获取单个 skill 全文（或列表接口直接带上 content）

## 四、节点间数据契约 ⚠️（必须同步改引擎）

**问题**：现有引擎多上游合并逻辑（`workflow.service.ts` ~318-342 行）会把每个上游输出 `Object.assign` **平铺到根**，导致 `inputObj.modelConfig` / `inputObj.skill` 对象键不存在。

**修正方案（推荐 A）**：改引擎合并逻辑，对 `model-config` 和 `skill` 两类上游**保留对象结构**：

```typescript
// workflow.service.ts 合并处
if (output && typeof output === 'object' && !Array.isArray(output)) {
  // model-config 与 skill 保留为独立对象键，其余平铺
  if (key === 'modelConfig' || upstreamNode.type === 'skill-config') {
    merged[key] = output;
  } else {
    Object.assign(merged, output);
  }
}
```

**最终契约**：
```
model-config 输出:  { apiBaseUrl, apiKey, model, cliPath, nodePath, permissionMode, workingDir, configured: true }
skill 节点输出:     { name, path, content, description }
视频分析节点读取:   inputObj.modelConfig.{cliPath,nodePath,model,permissionMode,workingDir}
                    inputObj.skill.{name, content}
```

## 五、边界与兼容

1. **节点删除**：`ai-analyze-seedance`（sd 节点）删除——类型枚举、注册、前端节点库、createNodeInstance 全部移除。已有工作流若引用需迁移（本次在 wb-demo 验证）。
2. **旧节点改造**：`ai-analyze-workbuddy-agent` 改造为通用视频分析节点（配置移除，读上游）。旧配置需迁移或前端标注。
3. **引擎串行执行**：分析节点与其它兄弟节点排队执行（非并行），属已知行为，不在此次范围。

## 六、验收标准

1. 模型配置节点可配置 Agent 全套参数（cliPath/nodePath/model/permissionMode/workingDir），且**不填 OpenAI 三件套也能通过校验**（Agent 场景）
2. Skill 配置节点自动列出项目所有已安装 skill（含目录型 seedance-2.0-main、单文件型 seedance-prompt-zh），选择后输出 skill 内容
3. 视频分析节点除分析模板外无任何配置，从上游读取 modelConfig + skill，能独立完成视频分析
4. **新链路全流程跑通**：model-config（agent 配置）→ skill（seedance-2.0-main）→ 视频分析节点 → 产出可用分析报告，历史记录可展开
5. sd 节点已从项目删除，前端节点库不再出现
6. 旧 wb-demo 工作流不因重构而损坏（或完成迁移）

## 七、开发顺序建议（修正版）

```
1. 后端 Skill 列表接口（/api/skills，兼容目录型+单文件型）
2. 引擎合并逻辑改造（modelConfig/skill 保留对象结构）← 地基，先做
3. Skill 配置节点（前端扫描+下拉+内容输出）
4. 模型配置节点扩展 Agent 字段 + 条件校验改造
5. 视频分析节点改造（移除配置，读上游 modelConfig + skill）
6. 新链路全流程验证：调试 wb-demo 工作流，确认功能完美实现
7. 删除多余节点（sd 节点等）← 最后执行，验证通过后再删
```

⚠️ **删除动作放最后**：重构期间 sd 节点等旧节点保持不动，作为功能对照与回退保障。必须在 wb-demo 调试、新链路功能完美验证后，才执行删除（类型枚举/注册/前端节点库/createNodeInstance 全清）。

## 八、本次对话背景说明

本次对话是 **skill 测试** 后的架构反思。开发完成后用 skill 节点选 `seedance-2.0-main` 即可复现 sd 节点效果，用于 skill 效果验证。
