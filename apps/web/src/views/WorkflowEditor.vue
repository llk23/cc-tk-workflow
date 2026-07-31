<template>
  <div class="workflow-editor">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="brand">🎬 TK 工作流</span>
        <input v-model="store.workflowName" class="wf-name" placeholder="工作流名称" />
      </div>
      <div class="toolbar-right">
        <select class="wf-load" @change="onLoadSelect">
          <option value="">📂 加载已有…</option>
          <option v-for="wf in savedList" :key="wf.id" :value="wf.id">{{ wf.name }}</option>
        </select>
        <button
          class="btn btn-danger-light"
          :disabled="!store.currentWorkflowId || store.currentWorkflowId.startsWith('local_')"
          @click="deleteWorkflow"
        >
          🗑 删除
        </button>
        <button class="btn btn-primary" @click="save">💾 保存</button>
        <button class="btn" :disabled="!canUndo" @click="undo">↩ 撤销</button>
        <button class="btn btn-run" :disabled="store.running" @click="run">
          {{ store.running ? '⏳ 运行中…' : '▶ 运行' }}
        </button>
      </div>
    </div>

    <div class="editor-layout">
      <!-- 左侧节点库 -->
      <aside class="node-palette">
        <h4>节点库</h4>
        <template v-for="cat in paletteCategories" :key="cat.name">
          <div class="palette-category">{{ cat.name }}</div>
          <div
            v-for="node in cat.nodes"
            :key="node.type"
            class="palette-item"
            :class="`palette-${cat.cls}`"
            draggable="true"
            @dragstart="onDragStart($event, node)"
          >
            <span class="node-icon">{{ node.icon }}</span>
            <div class="palette-meta">
              <strong>{{ node.label }}</strong>
              <p>{{ node.description }}</p>
            </div>
          </div>
        </template>
      </aside>

      <!-- 中间画布 -->
      <div class="canvas-area" @drop="onDrop" @dragover.prevent>
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes"
          :delete-key-code="null"
          :default-edge-options="{ style: { stroke: '#b0b0b0', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#b0b0b0' } }"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @pane-click="onPaneClick"
          fit-view-on-init
          class="vf"
        >
          <Background />
          <Controls />
        </VueFlow>
      </div>

      <!-- 右侧配置面板 -->
      <aside v-if="selectedNode" class="config-panel">
        <div class="config-header">
          <span class="config-icon">{{ nodeIcon(selectedNode.data.nodeType) }}</span>
          <div class="config-title">
            <h4>{{ selectedNode.data.label }}</h4>
            <span class="config-type">{{ selectedNode.data.nodeType }}</span>
          </div>
        </div>

        <template v-if="configGroups.length">
          <template v-for="group in configGroups" :key="group.name">
            <div class="cfg-group-header">{{ group.name }}</div>
            <div v-for="key in group.keys" :key="key" class="cfg-row">
              <label class="cfg-label">{{ fieldLabel(key) }}</label>
              <div class="cfg-control">
                <textarea
                  v-if="key === 'cookie'"
                  class="cfg-textarea"
                  rows="5"
                  :value="String((mergedConfig as any)[key] || '')"
                  @input="onCfgInput(key, $event)"
                  placeholder="粘贴从浏览器 DevTools 复制的完整 Cookie 字符串"
                ></textarea>

                <label v-else-if="typeof (mergedConfig as any)[key] === 'boolean'" class="cfg-toggle">
                  <input type="checkbox" :checked="!!(mergedConfig as any)[key]" @change="onCfgBool(key, $event)" />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                  <span class="toggle-text">{{ (mergedConfig as any)[key] ? '是' : '否' }}</span>
                </label>

                <select v-else-if="key === 'sortBy'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="relevance">相关度</option>
                  <option value="date">发布时间</option>
                  <option value="likes">点赞量</option>
                </select>

                <select v-else-if="key === 'commerceSource'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="all">全部（任一为真即带货）</option>
                  <option value="siECVideo">siECVideo 字段</option>
                  <option value="commerceInfo">commerceInfo.productInfo</option>
                  <option value="shoppingCart">shoppingCart 字段</option>
                </select>

                <select v-else-if="key === 'region'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="US">美国</option>
                  <option value="JP">日本</option>
                  <option value="TH">泰国</option>
                  <option value="VN">越南</option>
                  <option value="ID">印尼</option>
                  <option value="GB">英国</option>
                </select>

                <select v-else-if="key === 'videoDuration'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="all">不限时长</option>
                  <option value="short">短 (≤30秒)</option>
                  <option value="medium">中 (30~60秒)</option>
                  <option value="long">长 (&gt;60秒)</option>
                </select>

                <select v-else-if="key === 'publishTime'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="all">不限时间</option>
                  <option value="today">近 24 小时</option>
                  <option value="week">近 7 天</option>
                  <option value="month">近 30 天</option>
                </select>

                <input v-else-if="key === 'apiKey'" type="text" :value="String((mergedConfig as any)[key])" @input="onCfgInput(key, $event)" class="cfg-input" placeholder="sk- 或你的 API Key" />

                <!-- 模型配置节点的 model 字段：显示获取模型列表按钮 + 下拉 -->
                <template v-else-if="key === 'model' && selectedNode?.data.nodeType === 'model-config'">
                  <button class="cfg-fetch-btn" :disabled="fetchingModels" @click="onFetchModels">
                    {{ fetchingModels ? '⏳ 获取中…' : '🔍 获取模型列表' }}
                  </button>
                  <select :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select cfg-select-model">
                    <option value="">-- 请先获取模型列表 --</option>
                    <option v-for="m in fetchedModels" :key="m" :value="m">{{ m }}</option>
                  </select>
                </template>

                <!-- 条件节点：field 下拉选择（根据上游节点动态生成） -->
                <select v-else-if="key === 'field'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="" disabled>{{ conditionFieldOptions.length ? '-- 请选择字段 --' : '-- 请先连接上游节点 --' }}</option>
                  <option v-for="opt in conditionFieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>

                <!-- 条件节点：operator 下拉选择 -->
                <select v-else-if="key === 'operator'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="gt">&gt; 大于</option>
                  <option value="gte">&gt;= 大于等于</option>
                  <option value="lt">&lt; 小于</option>
                  <option value="lte">&lt;= 小于等于</option>
                  <option value="eq">== 等于</option>
                  <option value="neq">!= 不等于</option>
                </select>

                <!-- AI 分析模式下拉 -->
                <select v-else-if="key === 'analysisMode'" :value="String((mergedConfig as any)[key])" @change="onCfgSelect(key, $event)" class="cfg-select">
                  <option value="metadata">📊 元数据分析（文本，无需下载）</option>
                  <option value="video">🎬 全视频分析（上传视频给 AI 模型分析）</option>
                </select>

                <input v-else type="text" :value="String((mergedConfig as any)[key])" @input="onCfgInput(key, $event)" class="cfg-input" />
              </div>
            </div>
          </template>
        </template>
        <div v-else class="cfg-empty">该节点暂无可配置项</div>

        <div class="config-actions">
          <button class="btn btn-debug" :disabled="!store.currentWorkflowId || store.running" @click="debugSelectedNode">
            🐞 调试此节点
          </button>
          <button class="btn btn-danger" @click="deleteNode(store.selectedNodeId!)">🗑 删除节点</button>
          <button class="btn" @click="store.setSelected(null)">关闭</button>
        </div>
      </aside>

      <!-- 分析详情模态框（可拖拽，遮挡画布） -->
      <div v-if="drawerVideo" class="analysis-modal" :style="modalStyle" @mousedown="modalFocus">
        <div class="modal-header" @mousedown.prevent="startDrag">
          <div class="modal-hd-left">
            <span class="modal-title">视频 #{{ drawerIndex! + 1 }} 详情</span>
            <span class="modal-id">{{ drawerVideo?.videoId?.slice(0, 12) }}…</span>
            <span class="modal-author" v-if="drawerVideo?.author">@{{ drawerVideo.author }}</span>
          </div>
          <button class="modal-close" @click="drawerVideo = null">✕</button>
        </div>

        <div class="modal-body">
          <!-- 评分 + 元数据 -->
          <div class="md-grid-2">
            <div class="md-card">
              <div class="md-ct">评分</div>
              <div class="md-scores">
                <span class="md-score-lg" :class="scoreClass(drawerVideo?.qualityScore)">{{ drawerVideo?.qualityScore }}</span>
                <div><div class="md-sl">综合质量</div><div class="md-ss">钩子 {{ drawerVideo?.hookRating }}/10</div></div>
              </div>
              <div class="md-meta">
                <span>▶ {{ fmtNum(drawerVideo?.plays) }}</span>
                <span>❤ {{ fmtNum(drawerVideo?.likes) }}</span>
                <span>💬 {{ fmtNum(drawerVideo?.comments) }}</span>
                <span class="md-dur">{{ drawerVideo?.duration }}s</span>
              </div>
            </div>
            <div class="md-card">
              <div class="md-ct">概览</div>
              <div class="md-row"><span class="md-lbl">风格</span><span class="md-val">{{ drawerParsed?.visual?.styleCategory || drawerVideo?.styleCategory || '—' }}</span></div>
              <div class="md-row"><span class="md-lbl">节奏</span><span class="md-val">{{ drawerParsed?.structure?.pacing || '—' }}</span></div>
              <div class="md-row"><span class="md-lbl">文案</span><span class="md-val">{{ drawerVideo?.captionStructure || drawerParsed?.caption?.structure || '—' }}</span></div>
              <div class="md-row"><span class="md-lbl">情感</span><span class="md-val md-emotion">{{ drawerParsed?.viral?.emotionalTrigger || '—' }}</span></div>
            </div>
          </div>

          <div class="md-grid-2">
            <div class="md-card">
              <div class="md-ct">视觉</div>
              <div class="md-row" v-if="drawerParsed?.visual?.cameraLanguage?.length"><span class="md-lbl">运镜</span><span class="md-val">{{ drawerParsed.visual.cameraLanguage.join(' · ') }}</span></div>
              <div class="md-row" v-if="drawerParsed?.visual?.colorPalette?.length"><span class="md-lbl">色调</span><span class="md-val">{{ drawerParsed.visual.colorPalette.join(' · ') }}</span></div>
              <div class="md-row" v-if="drawerParsed?.visual?.textOverlay !== undefined"><span class="md-lbl">文字</span><span class="md-val">{{ drawerParsed.visual.textOverlay ? '有覆盖' : '无覆盖' }}</span></div>
              <div class="md-row" v-else><span class="md-val" style="color:#ccc">无视觉数据</span></div>
            </div>
            <div class="md-card">
              <div class="md-ct">结构</div>
              <div class="md-row"><span class="md-lbl">钩子</span><span class="md-val">{{ drawerParsed?.structure?.hookType || '—' }}</span></div>
              <div class="md-row" v-if="drawerParsed?.structure?.contentFlow?.length"><span class="md-lbl">流程</span><span class="md-val">{{ drawerParsed.structure.contentFlow.slice(0,4).join(' → ') }}</span></div>
            </div>
          </div>

          <div class="md-grid-2">
            <div class="md-card">
              <div class="md-ct">音频</div>
              <div class="md-row"><span class="md-lbl">BGM</span><span class="md-val">{{ drawerParsed?.audio?.bgmMood || '—' }}</span></div>
              <div class="md-row"><span class="md-lbl">人声</span><span class="md-val">{{ drawerParsed?.audio?.voiceoverStyle || '—' }}</span></div>
            </div>
            <div class="md-card">
              <div class="md-ct">受众</div>
              <div class="md-row" v-if="drawerVideo?.targetAudience?.length"><span class="md-val">{{ drawerVideo.targetAudience.slice(0, 4).join(' · ') }}</span></div>
              <div class="md-row" v-if="drawerParsed?.caption?.keyPhrases?.length"><span class="md-lbl">关键词</span><span class="md-val">{{ drawerParsed.caption.keyPhrases.join(' · ') }}</span></div>
            </div>
          </div>

          <div class="md-card md-card-full">
            <div class="md-ct">核心要素</div>
            <div class="md-row"><span class="md-lbl">风格标签</span>
              <span class="md-val tags-inline">
                <span v-for="(t, ti) in (drawerParsed?.replication?.styleTags || [])" :key="ti" class="md-tag">{{ t }}</span>
                <span v-if="!drawerParsed?.replication?.styleTags?.length">—</span>
              </span>
            </div>
            <div class="md-row" v-if="drawerParsed?.replication?.keyIngredients?.length"><span class="md-lbl">关键元素</span><span class="md-val">{{ drawerParsed.replication.keyIngredients.join(' · ') }}</span></div>
            <div class="md-row" v-if="drawerParsed?.viral?.trendAlignment"><span class="md-lbl">趋势</span><span class="md-val">{{ drawerParsed.viral.trendAlignment }}/10</span></div>
            <div class="md-tags">
              <span v-for="(t, ti) in (drawerVideo?.generatedTags || [])" :key="ti" class="md-tag-li">{{ t }}</span>
            </div>
          </div>

          <!-- 生成提示词 -->
          <div class="md-card md-card-full md-card-prompt">
            <div class="md-ct md-ct-row">
              <span>🎬 生成提示词</span>
              <span class="md-prompt-hint">可编辑 · 修改后点击保存</span>
            </div>
            <textarea class="md-prompt-ta" :value="drawerEditedPrompt" @input="drawerEditedPrompt = ($event.target as HTMLTextAreaElement).value" placeholder="暂无生成提示词" rows="6"></textarea>
            <div class="md-save-row">
              <span v-if="drawerSaveStatus" class="md-save-status">{{ drawerSaveStatus }}</span>
              <button class="md-save-btn" @click="saveDrawerPrompt">💾 保存提示词</button>
            </div>
          </div>

          <!-- 优化建议 -->
          <div class="md-card md-card-full">
            <div class="md-ct">优化建议</div>
            <ul class="md-sug-list" v-if="drawerVideo?.suggestions?.length">
              <li v-for="(s, si) in drawerVideo.suggestions" :key="si" class="md-sug-item">{{ s }}</li>
            </ul>
            <div v-else class="md-val" style="color:#ccc">—</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部：执行日志 / 结果 -->
    <div class="exec-log" ref="logContainer">
      <div class="exec-log-header">
        <div class="log-tabs">
          <button :class="['log-tab', { active: activeTab === 'log' }]" @click="activeTab = 'log'">
            📋 执行日志
          </button>
          <button :class="['log-tab', { active: activeTab === 'result' }]" @click="activeTab = 'result'">
            📊 结果
          </button>
        </div>
        <button class="btn-link" @click="activeTab === 'log' ? store.clearLogs() : (result = null)">
          {{ activeTab === 'log' ? '清空' : '清空结果' }}
        </button>
      </div>

      <div class="exec-log-body">
        <template v-if="activeTab === 'log'">
          <div v-for="(l, i) in store.logs" :key="i" class="log-line">{{ l }}</div>
          <div v-if="store.logs.length === 0" class="log-empty">暂无日志，点击「▶ 运行」开始</div>
        </template>

        <template v-else>
          <pre v-if="result" class="result-json">{{ resultText }}</pre>
          <div v-else class="log-empty">暂无结果。运行工作流 / 调试节点后，结果会显示在这里</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useWorkflowStore } from '@/stores/workflow'
import { workflowApi } from '@/api'
import CustomNode from '@/components/CustomNode.vue'
import { useExecutionSocket } from '@/composables/useExecutionSocket'

const store = useWorkflowStore()
const {
  nodes,
  edges,
  addNodes,
  addEdges,
  onConnect,
  updateNodeData,
  findNode,
  setNodes,
  setEdges,
  removeNodes,
  removeEdges,
  screenToFlowCoordinate,
} = useVueFlow()

const nodeTypes = { custom: CustomNode } as any

const iconMap: Record<string, string> = {
  'fetch-tk': '📥',
  'tk-account-verify': '🔐',
  'model-config': '🤖',
  'ai-analyze': '🧠',
  'ai-analyze-seedance': '🎯',
  'video-generate': '🎬',
  transform: '🔄',
  condition: '🔀',
  output: '📤',
}
function nodeIcon(type?: string): string {
  return (type && iconMap[type]) || '⚙️'
}

// ===== 分析详情模态框（可拖拽） =====
import { provide, ref, computed, watch } from 'vue'
import axios from 'axios'

const drawerVideo = ref<any>(null)
const drawerIndex = ref<number | null>(null)
const drawerAnalyses = ref<any[]>([])
const drawerEditedPrompt = ref('')
const drawerSaveStatus = ref('')

// 拖拽状态
const modalPos = ref({ x: 60, y: 60 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragOrigin = ref({ x: 0, y: 0 })
const modalStyle = computed(() => ({
  left: modalPos.value.x + 'px',
  top: modalPos.value.y + 'px',
}))

function startDrag(e: MouseEvent) {
  dragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  dragOrigin.value = { x: modalPos.value.x, y: modalPos.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}
function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  modalPos.value = {
    x: dragOrigin.value.x + (e.clientX - dragStart.value.x),
    y: dragOrigin.value.y + (e.clientY - dragStart.value.y),
  }
}
function endDrag() {
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
}
function modalFocus() {
  // 点击模态框时将其移到最前（z-index 已由 CSS 控制）
}

const drawerParsed = computed(() => {
  const v = drawerVideo.value
  if (!v?.rawOutput) return null
  try { return JSON.parse(v.rawOutput) } catch { return null }
})

watch(drawerVideo, (v) => {
  if (v?.rawOutput) {
    try { const p = JSON.parse(v.rawOutput); drawerEditedPrompt.value = p?.replication?.generationPrompt || '' } catch { drawerEditedPrompt.value = '' }
  } else { drawerEditedPrompt.value = '' }
})

provide('openAnalysisDetail', (video: any, allAnalyses: any[], index: number) => {
  drawerAnalyses.value = allAnalyses
  drawerVideo.value = video
  drawerIndex.value = index
  drawerSaveStatus.value = ''
})

async function saveDrawerPrompt() {
  const id = store.currentWorkflowId
  if (!id) return
  // 从历史记录中找到对应这条分析的 executionId
  try {
    const histRes = await axios.get(`/api/workflows/${id}/history`, { timeout: 5000 })
    const list: Array<any> = Array.isArray(histRes.data) ? histRes.data : []
    for (const exec of list) {
      if (exec.status !== 'completed') continue
      const allResults = exec.result as Record<string, any> | undefined
      if (!allResults) continue
      // 找执行结果中包含当前视频的 execution
      for (const [nodeId, output] of Object.entries(allResults)) {
        if ((output as any)?.analyses?.length) {
          const idx = (output as any).analyses.findIndex((a: any) => a.videoId === drawerVideo.value?.videoId)
          if (idx >= 0) {
            drawerSaveStatus.value = '保存中…'
            await axios.put(`/api/workflows/${id}/history/${exec.id}/analysis`, {
              nodeId,
              videoIdx: idx,
              prompt: drawerEditedPrompt.value,
            })
            drawerSaveStatus.value = '✅ 已保存'
            setTimeout(() => drawerSaveStatus.value = '', 2000)
            return
          }
        }
      }
    }
    drawerSaveStatus.value = '⚠️ 未找到执行记录'
  } catch (e: any) {
    drawerSaveStatus.value = '❌ 保存失败'
  }
}

function scoreClass(s: number): string {
  if (s >= 8) return 'sc-high'
  if (s >= 6) return 'sc-mid'
  return 'sc-low'
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 10_000).toFixed(1) + 'W'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const availableNodes = [
  { type: 'fetch-tk', label: 'TK 视频抓取', icon: '📥', description: '通过浏览器搜索 TK 视频，支持带货判定与多种过滤' },
  { type: 'tk-account-verify', label: 'TK 账号验证', icon: '🔐', description: '校验 TikTok 登录 Cookie 是否有效' },
  { type: 'model-config', label: 'AI 模型配置', icon: '🤖', description: '配置多模态分析模型（OpenAI 兼容接口）' },
  { type: 'ai-analyze', label: 'AI 视频分析', icon: '🧠', description: '多模态 AI 分析' },
  { type: 'ai-analyze-seedance', label: '视频分析(即梦SD2.0)', icon: '🎯', description: '加载Seedance2.0技能指南，输出SD2.0格式提示词' },
  { type: 'video-generate', label: 'AI 视频生成', icon: '🎬', description: '生成新视频' },
  { type: 'transform', label: '数据转换', icon: '🔄', description: '格式转换/过滤' },
  { type: 'condition', label: '条件判断', icon: '🔀', description: '条件分支路由' },
  { type: 'output', label: '结果输出', icon: '📤', description: '保存/通知' },
]

/** 左侧节点库按类别分组 */
interface PaletteCategory { name: string; cls: string; nodes: typeof availableNodes }
const paletteCategories: PaletteCategory[] = [
  { name: '数据源', cls: 'input', nodes: availableNodes.filter(n => ['fetch-tk','tk-account-verify'].includes(n.type)) },
  { name: '配置', cls: 'config', nodes: availableNodes.filter(n => ['model-config'].includes(n.type)) },
  { name: 'AI 处理', cls: 'ai', nodes: availableNodes.filter(n => ['ai-analyze','ai-analyze-seedance','video-generate'].includes(n.type)) },
  { name: '逻辑处理', cls: 'transform', nodes: availableNodes.filter(n => ['transform','condition'].includes(n.type)) },
  { name: '输出', cls: 'output', nodes: availableNodes.filter(n => ['output'].includes(n.type)) },
]

const FIELD_LABELS: Record<string, string> = {
  cookie: '登录 Cookie（完整字符串）',
  region: '地区',
  keyword: '搜索关键词',
  source: '数据源',
  maxCount: '最大抓取数',
  sortBy: '排序方式',
  minPlays: '最低播放量',
  minLikes: '最低点赞量',
  maxVideos: '最大视频数',
  commerceSource: '带货判定来源',
  commerceOnly: '仅保留带货视频',
  autoDownload: '自动下载视频',
  videoDuration: '视频时长',
  publishTime: '发布时间',
  apiBaseUrl: 'API 地址',
  apiKey: 'API Key',
  model: '模型',
  provider: 'AI 供应商',
  analysisDimensions: '分析维度',
  customPrompt: '自定义分析指令（可选，例如：重点关注产品的包装方式）',
  extractHooks: '提取钩子',
  analysisMode: '分析模式',
  maxFrames: '每视频帧数',
  field: '比较字段',
  operator: '比较符',
  value: '阈值',
  tool: '生成工具',
  durationSec: '时长(秒)',
}
function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key
}

function defaultConfig(nodeType: string): Record<string, unknown> {
  switch (nodeType) {
    case 'fetch-tk':
      return { keyword: '', maxCount: 20, sortBy: 'relevance', minPlays: 0, minLikes: 0, region: 'US', commerceSource: 'all', commerceOnly: false, autoDownload: false, videoDuration: 'all', publishTime: 'all' }
    case 'tk-account-verify':
      return { cookie: '', region: 'US' }
    case 'model-config':
      return { apiBaseUrl: '', apiKey: '', model: '' }
    case 'ai-analyze-seedance':
      return { analysisMode: 'video', customPrompt: '' }
    case 'condition':
      return { field: 'duration', operator: 'gt', value: 30 }
    case 'ai-analyze':
      return { analysisMode: 'metadata', customPrompt: '' }
    case 'video-generate':
      return { tool: 'runway', durationSec: 15 }
    default:
      return {}
  }
}

// 拖拽添加节点
function onDragStart(event: DragEvent, node: { type: string; label: string; icon: string }) {
  event.dataTransfer?.setData('application/vueflow', JSON.stringify(node))
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('application/vueflow')
  if (!raw) return
  const node = JSON.parse(raw) as { type: string; label: string; icon: string }
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const id = `${node.type}_${Date.now()}`
  pushHistory()
  addNodes([
    {
      id,
      type: 'custom',
      position,
      data: { label: node.label, nodeType: node.type, icon: node.icon, config: defaultConfig(node.type), status: 'idle' },
    },
  ])
}

// 连线（先记历史，便于撤销）
onConnect((connection) => {
  pushHistory()
  addEdges(connection)
})

// ===== 撤销栈：记录每次结构性变更前的快照（新增/删除/连线） =====
const undoStack = ref<Array<{ nodes: any[]; edges: any[] }>>([])
const canUndo = computed(() => undoStack.value.length > 0)

function snapshot() {
  const ns = nodes.value.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: JSON.parse(JSON.stringify(n.data)),
  }))
  const es = edges.value.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }))
  return { nodes: ns, edges: es }
}
function pushHistory() {
  undoStack.value.push(snapshot())
  if (undoStack.value.length > 50) undoStack.value.shift()
}
function undo() {
  const snap = undoStack.value.pop()
  if (!snap) return
  setNodes(snap.nodes.map((n) => ({ ...n })))
  setEdges(snap.edges.map((e) => ({ ...e })))
  store.addLog('已撤销上一步操作')
}

// 删除节点（连同其连线一并删除），删除前先记历史
function deleteNode(id: string) {
  if (!id) return
  const node = findNode(id)
  if (!node) return
  pushHistory()
  const connected = edges.value.filter((e) => e.source === id || e.target === id).map((e) => e.id)
  if (connected.length) removeEdges(connected)
  removeNodes([id])
  if (store.selectedNodeId === id) store.setSelected(null)
  store.addLog('已删除节点：' + (node.data.label || id))
}

// 点击画布空白处取消选中（节点 + 边）
function onPaneClick() {
  store.setSelected(null)
  edges.value.forEach((e: any) => { e.selected = false })
  selectedEdgeId.value = null
}

// 键盘 Delete / Backspace 删除选中的边或节点（输入框内不触发）
function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // 优先删除选中的连线
    if (selectedEdgeId.value) {
      e.preventDefault()
      deleteEdge(selectedEdgeId.value)
      return
    }
    // 其次删除选中的节点
    if (store.selectedNodeId) {
      e.preventDefault()
      deleteNode(store.selectedNodeId)
    }
  }
}

// 删除单条连线
function deleteEdge(edgeId: string) {
  const edge = edges.value.find((e: any) => e.id === edgeId)
  if (!edge) return
  pushHistory()
  removeEdges([edgeId])
  selectedEdgeId.value = null
  store.addLog(`已删除连线：${edge.source} → ${edge.target}`)
}

// ===== 边缘（连线）选中与删除 =====
const selectedEdgeId = ref<string | null>(null)

// 选中节点 → 打开配置面板
function onNodeClick(event: { node: { id: string } }) {
  selectedEdgeId.value = null // 选中节点时清除边选中
  store.setSelected(event.node.id)
}

// 选中连线
function onEdgeClick(event: { edge: { id: string } }) {
  store.setSelected(null) // 选中边时清除节点选中
  // 清除所有边的选中状态
  edges.value.forEach((e: any) => { e.selected = false })
  selectedEdgeId.value = event.edge.id
  // 高亮选中边
  const edge = edges.value.find((e: any) => e.id === event.edge.id)
  if (edge) edge.selected = true
}
const selectedNode = computed(() => (store.selectedNodeId ? findNode(store.selectedNodeId) : null))
const configEntries = computed<Array<[string, any]>>(() => {
  const node = selectedNode.value
  if (!node) return []
  // 始终按节点类型的默认配置渲染全部字段，再叠加已保存值。
  // 这样即使是早于新字段定义前保存的旧节点，也能完整显示（如视频时长 / 发布时间）。
  const base = defaultConfig(node.data.nodeType || '')
  const cfg = (node.data && node.data.config) || {}
  const merged = { ...base, ...cfg }
  return Object.entries(merged)
})

/** 合并后的配置对象（供模板直接读取值） */
const mergedConfig = computed<Record<string, unknown>>(() => {
  const entries = configEntries.value
  return Object.fromEntries(entries)
})

/** 配置分组结构：按节点类型将字段分组展示 */
interface ConfigGroup { name: string; keys: string[] }
const FETCH_TK_GROUPS: ConfigGroup[] = [
  { name: '搜索参数', keys: ['keyword', 'maxCount', 'region', 'sortBy'] },
  { name: '过滤条件', keys: ['minPlays', 'minLikes', 'videoDuration', 'publishTime', 'commerceSource', 'commerceOnly'] },
  { name: '下载选项', keys: ['autoDownload'] },
]
const GROUPS_BY_TYPE: Record<string, ConfigGroup[]> = {
  'fetch-tk': FETCH_TK_GROUPS,
  'tk-account-verify': [{ name: '账号配置', keys: ['cookie', 'region'] }],
  'model-config': [{ name: 'API 配置', keys: ['apiBaseUrl', 'apiKey'] }, { name: '模型选择', keys: ['model'] }],
  'condition': [{ name: '筛选条件', keys: ['field', 'operator', 'value'] }],
  'ai-analyze': [
    { name: '分析模式', keys: ['analysisMode'] },
    { name: '自定义分析指令', keys: ['customPrompt'] },
  ],
  'ai-analyze-seedance': [
    { name: 'Seedance 2.0 分析', keys: ['analysisMode'] },
    { name: '自定义分析指令', keys: ['customPrompt'] },
  ],
  'video-generate': [{ name: '生成设置', keys: ['tool', 'durationSec'] }],
}
const configGroups = computed<ConfigGroup[]>(() => {
  const type = selectedNode.value?.data.nodeType || ''
  return GROUPS_BY_TYPE[type] || [{ name: '通用配置', keys: configEntries.value.map(([k]) => k) }]
})

// ===== 条件判断节点：根据上游节点类型动态生成字段选项 =====
interface FieldOption { value: string; label: string }
const FIELD_OPTIONS_BY_UPSTREAM: Record<string, FieldOption[]> = {
  'fetch-tk': [
    { value: 'duration', label: '时长(秒)' },
    { value: 'plays', label: '播放量' },
    { value: 'likes', label: '点赞数' },
    { value: 'comments', label: '评论数' },
    { value: 'shares', label: '分享数' },
  ],
  'tk-account-verify': [
    { value: 'cookie', label: 'Cookie 有效性' },
  ],
  'ai-analyze': [
    { value: 'qualityScore', label: '质量评分' },
    { value: 'hookRating', label: '钩子评分' },
    { value: 'total', label: '分析总数' },
  ],
  'condition': [
    { value: 'filtered.matched', label: '符合条件数' },
    { value: 'filtered.total', label: '总视频数' },
  ],
}
const DEFAULT_CONDITION_FIELDS: FieldOption[] = [
  { value: 'duration', label: '时长(秒)' },
  { value: 'plays', label: '播放量' },
  { value: 'likes', label: '点赞数' },
]
const conditionFieldOptions = computed<FieldOption[]>(() => {
  const node = selectedNode.value
  if (!node || node.data.nodeType !== 'condition') return []
  // 找上游节点（连到 condition 输入端的那个）
  const incomingEdge = edges.value.find(e => e.target === node.id)
  if (!incomingEdge) return [] // 未连线时为空，模板显示占位提示
  const upstream = findNode(incomingEdge.source)
  const upstreamType = upstream?.data?.nodeType || ''
  return FIELD_OPTIONS_BY_UPSTREAM[upstreamType] || DEFAULT_CONDITION_FIELDS
})
const fetchedModels = ref<string[]>([])
const fetchingModels = ref(false)

async function onFetchModels() {
  const node = selectedNode.value
  if (!node) return
  const cfg = (node.data && node.data.config) || {} as any
  const apiBaseUrl = cfg.apiBaseUrl || ''
  const apiKey = cfg.apiKey || ''
  if (!apiBaseUrl || !apiKey) {
    store.addLog('⚠️ 请先填写 API 地址和 API Key')
    return
  }
  fetchingModels.value = true
  fetchedModels.value = []
  store.addLog(`🔍 正在获取模型列表：${apiBaseUrl}`)
  try {
    const res = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiBaseUrl, apiKey }),
    })
    const data = await res.json()
    if (data.success && Array.isArray(data.models)) {
      fetchedModels.value = data.models
      store.addLog(`✅ 获取到 ${data.total} 个可用模型`)
    } else {
      store.addLog('❌ 获取模型列表失败：' + (data.message || '未知错误'))
    }
  } catch (e: any) {
    store.addLog(`❌ 获取模型列表失败：${e.message || e}`)
  } finally {
    fetchingModels.value = false
  }
}

// 当选中的节点是 model-config 且已有 apiBaseUrl/apiKey 时，自动获取模型列表
watch(selectedNode, async (node) => {
  if (!node || node.data?.nodeType !== 'model-config') return
  const cfg = (node.data?.config || {}) as any
  if (!cfg.apiBaseUrl || !cfg.apiKey) return
  if (fetchedModels.value.length > 0) return // 已有缓存，不再重复获取
  await onFetchModels()
})

// 配置面板输入写回节点 data
function onCfgInput(key: string, e: Event) {
  if (!store.selectedNodeId) return
  const value = (e.target as HTMLInputElement).value
  const node = findNode(store.selectedNodeId)
  const config = { ...(node?.data.config || {}), [key]: value }
  updateNodeData(store.selectedNodeId, { config })
}
function onCfgBool(key: string, e: Event) {
  if (!store.selectedNodeId) return
  const checked = (e.target as HTMLInputElement).checked
  const node = findNode(store.selectedNodeId)
  const config = { ...(node?.data.config || {}), [key]: checked }
  updateNodeData(store.selectedNodeId, { config })
}
function onCfgSelect(key: string, e: Event) {
  if (!store.selectedNodeId) return
  const value = (e.target as HTMLSelectElement).value
  const node = findNode(store.selectedNodeId)
  const config = { ...(node?.data.config || {}), [key]: value }
  updateNodeData(store.selectedNodeId, { config })
}

// ===================== 保存 / 加载（服务端优先 + 本地兜底） =====================
const LS_PREFIX = 'tk_wf_'
const savedList = ref<Array<{ id: string; name: string }>>([])

function buildPayload() {
  return {
    name: store.workflowName || '未命名工作流',
    description: '',
    status: 'active',
    trigger: { type: 'manual' },
    nodes: nodes.value.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      icon: n.data.icon,
      position: n.position,
      config: n.data.config,
    })),
    edges: edges.value.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }
}

function applyWorkflow(wf: any) {
  store.currentWorkflowId = wf.id
  store.workflowName = wf.name || '未命名工作流'
  setNodes(
    (wf.nodes || []).map((n: any) => ({
      id: n.id,
      type: 'custom',
      position: n.position || { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        icon: n.icon,
        config: n.config || {},
        status: 'idle',
      },
    })),
  )
  setEdges((wf.edges || []).map((e: any) => ({ id: e.id, source: e.source, target: e.target })))
  store.setSelected(null)
}

async function save() {
  const payload = buildPayload()
  try {
    let res
    if (store.currentWorkflowId && !store.currentWorkflowId.startsWith('local_')) {
      res = await workflowApi.update(store.currentWorkflowId, payload)
    } else {
      res = await workflowApi.create(payload)
    }
    const id = res.data.id
    store.currentWorkflowId = id
    store.addLog('✅ 已保存到服务端：' + id)
  } catch (e: any) {
    const id =
      store.currentWorkflowId && store.currentWorkflowId.startsWith('local_')
        ? store.currentWorkflowId
        : 'local_' + Date.now()
    localStorage.setItem(LS_PREFIX + id, JSON.stringify({ ...payload, id }))
    store.currentWorkflowId = id
    store.addLog('⚠️ 服务端未连接，已保存到本地浏览器：' + id)
  }
  refreshSavedList()
}

async function load(id: string) {
  try {
    const res = await workflowApi.get(id)
    applyWorkflow(res.data)
    store.addLog('✅ 已从服务端加载：' + id)
    return
  } catch {
    // 服务端不可达，尝试本地
  }
  const raw = localStorage.getItem(LS_PREFIX + id)
  if (raw) {
    try {
      applyWorkflow(JSON.parse(raw))
      store.addLog('⚠️ 已从本地浏览器加载：' + id)
      return
    } catch {
      /* ignore */
    }
  }
  store.addLog('❌ 未找到工作流：' + id)
}

// 加载列表：服务端优先（SQL Server 为真源）；本地 localStorage 仅作离线兜底，
// 且与数据库同名/同 id 的本地副本会被删除，避免重复显示。
async function refreshSavedList() {
  const list: Array<{ id: string; name: string }> = []
  const nameSet = new Set<string>()
  try {
    const res = await workflowApi.list()
    const arr = Array.isArray(res.data) ? res.data : res.data?.items ?? []
    for (const wf of arr) {
      const name = wf.name || wf.id
      list.push({ id: wf.id, name })
      nameSet.add(name.toLowerCase())
    }
  } catch {
    /* 服务端不可达，忽略 */
  }
  // 先收集本地条目（避免遍历时修改 localStorage 引发索引错乱）
  const localEntries: Array<{ key: string; wf: any }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(LS_PREFIX)) {
      try {
        localEntries.push({ key: k, wf: JSON.parse(localStorage.getItem(k) || '{}') })
      } catch {
        /* ignore */
      }
    }
  }
  const seen = new Set(list.map((x) => x.id))
  for (const { key, wf } of localEntries) {
    const id = wf.id
    const name = (wf.name || wf.id).toLowerCase()
    if (seen.has(id) || nameSet.has(name)) {
      // 与数据库同 id 或同名：数据库才是真源，删除本地副本
      localStorage.removeItem(key)
    } else {
      list.push({ id, name: wf.name || wf.id })
    }
  }
  savedList.value = list
}

function onLoadSelect(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  if (id) load(id)
}

// ===================== 结果面板 / 单节点调试 / 删除 =====================
const activeTab = ref<'log' | 'result'>('log')
const result = ref<unknown>(null)
const logContainer = ref<HTMLElement | null>(null)

/** 日志自动滚到底部 */
watch(() => store.logs.length, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})
const resultText = computed(() => {
  try {
    return JSON.stringify(result.value, null, 2)
  } catch {
    return String(result.value)
  }
})

// 运行结束后从服务端拉取最新一次执行的最终结果，兜底刷新结果面板
async function fetchLatestResult() {
  const id = store.currentWorkflowId
  if (!id || id.startsWith('local_')) return
  try {
    const res = await workflowApi.history(id)
    const arr = Array.isArray(res.data) ? res.data : []
    if (arr.length && arr[0]?.result) {
      const lastResult = arr[0].result
      result.value = lastResult
      // 将最近一次执行的输出写入对应节点的 data.output
      Object.entries(lastResult).forEach(([nodeId, output]) => {
        updateNodeData(nodeId, { output, status: 'success' })
      })
    }
  } catch {
    /* ignore */
  }
}

// 单节点隔离调试：先保存工作流（把当前画布配置落库），再用保存后的配置执行调试
async function debugSelectedNode() {
  const id = store.selectedNodeId
  if (!id) return
  if (!store.currentWorkflowId || store.currentWorkflowId.startsWith('local_')) {
    store.addLog('⚠️ 请先保存工作流，再调试节点')
    return
  }
  store.addLog('💾 调试前自动保存工作流…')
  await save()
  store.addLog('🐞 调试节点：' + (selectedNode.value?.data.label || id))
  try {
    const res = await workflowApi.debug(store.currentWorkflowId, id)
    const d = res.data
    ;(d.logs || []).forEach((l: string) => store.addLog('  [调试] ' + l))
    store.addLog('  ✅ 输出：' + JSON.stringify(d.output))
    result.value = { [id]: d.output }
    updateNodeData(id, { output: d.output, status: 'success' })
    activeTab.value = 'result'
  } catch (e: any) {
    store.addLog('❌ 调试失败：' + (e?.message || e))
  }
}

// 删除当前已保存的工作流（含本地兜底副本 + 画布清空）
async function deleteWorkflow() {
  const id = store.currentWorkflowId
  if (!id || id.startsWith('local_')) {
    store.addLog('⚠️ 当前没有可删除的已保存工作流')
    return
  }
  if (!window.confirm(`确认删除工作流「${store.workflowName}」？该操作不可恢复。`)) return
  try {
    await workflowApi.remove(id)
    localStorage.removeItem(LS_PREFIX + id)
    store.addLog('🗑 已删除工作流：' + id)
    store.currentWorkflowId = ''
    store.workflowName = ''
    setNodes([])
    setEdges([])
    store.setSelected(null)
    result.value = null
  } catch (e: any) {
    store.addLog('❌ 删除失败：' + (e?.message || e))
  }
  refreshSavedList()
}

// ===================== 运行（先保存，再连 WS 收进度） =====================
async function run() {
  if (!store.currentWorkflowId) await save()
  if (!store.currentWorkflowId) {
    store.addLog('⚠️ 保存失败，无法运行')
    return
  }
  store.clearLogs()
  store.running = true
  try {
    const res = await workflowApi.execute(store.currentWorkflowId)
    const executionId = res.data.executionId
    store.addLog('已提交执行，executionId=' + executionId)

    nodes.value.forEach((n) => updateNodeData(n.id, { status: 'idle' }))

    const sock = useExecutionSocket()
    sock.connect(executionId, (evt) => {
      if (evt.nodeId) {
        if (evt.type === 'node:start') updateNodeData(evt.nodeId, { status: 'running' })
        else if (evt.type === 'node:success') updateNodeData(evt.nodeId, { status: 'success' })
        else if (evt.type === 'node:failed') updateNodeData(evt.nodeId, { status: 'failed' })
      }
      store.addLog(evt.message || evt.type)
      if (evt.type === 'result') {
        try {
          const allResults = JSON.parse(evt.message || '{}')
          result.value = allResults
          // 把每个节点的输出写入 node data，供画布内展示
          Object.entries(allResults).forEach(([nodeId, output]) => {
            updateNodeData(nodeId, { output, status: 'success' })
          })
        } catch {
          /* ignore */
        }
      }
      if (evt.type === 'completed' || evt.type === 'failed') {
        store.running = false
        fetchLatestResult()
      }
    })
  } catch (e: any) {
    store.running = false
    store.addLog('❌ 执行失败（需连接服务端）：' + (e?.message || e))
  }
}

onMounted(() => {
  refreshSavedList()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 110px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e8e8ec;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand {
  font-weight: 700;
  font-size: 15px;
  color: #1a1a2e;
}
.wf-name {
  padding: 7px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 7px;
  font-size: 13px;
  width: 200px;
}
.wf-name:focus {
  outline: none;
  border-color: #4a90d9;
}
.wf-load {
  padding: 7px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 7px;
  font-size: 13px;
  background: #fff;
  cursor: pointer;
  max-width: 200px;
}
.btn {
  padding: 7px 14px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) {
  border-color: #4a90d9;
  color: #4a90d9;
}
.btn:disabled {
  background: #f5f5f5;
  color: #bbb;
  cursor: not-allowed;
  border-color: #e0e0e0;
}
.btn-primary {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}
.btn-primary:hover:not(:disabled) {
  background: #3a80c9;
  color: #fff;
}
.btn-run {
  background: #36b37e;
  color: #fff;
  border-color: #36b37e;
}
.btn-run:hover:not(:disabled) {
  background: #2da06e;
  color: #fff;
}
.btn-danger {
  color: #e5484d;
  border-color: #f3c2c4;
}
.btn-danger:hover {
  background: #fdeced;
  color: #e5484d;
}
.btn-danger-light {
  color: #e5484d;
  border-color: #e0e0e0;
}
.btn-danger-light:hover:not(:disabled) {
  background: #fdeced;
  color: #e5484d;
  border-color: #f3c2c4;
}
.btn-debug {
  background: #7b61ff;
  color: #fff;
  border-color: #7b61ff;
}
.btn-debug:hover:not(:disabled) {
  background: #6a4fe0;
  color: #fff;
}
.log-tabs {
  display: flex;
  gap: 4px;
}
.log-tab {
  background: none;
  border: none;
  color: #6a6a8a;
  cursor: pointer;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  transition: all 0.15s;
}
.log-tab.active {
  background: #2a2a4e;
  color: #fff;
}
.log-tab:hover:not(.active) {
  color: #aaa;
}
.result-json {
  margin: 0;
  padding: 8px 4px;
  color: #b8f5d0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
.editor-layout {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

/* ===== 连线（Edge）选中高亮 ===== */
/* 点击选中变红色高亮，Delete 键可删除 */
:deep(.vue-flow__edge .vue-flow__edge-path) {
  cursor: pointer;
  transition: stroke 0.15s, stroke-width 0.15s;
}
:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #e5484d;
  stroke-width: 4.5;
  filter: drop-shadow(0 0 4px rgba(229, 72, 77, 0.4));
}
:deep(.vue-flow__edge.selected .vue-flow__edge-text) {
  font-weight: 700;
}
:deep(.vue-flow__edge .vue-flow__arrow-closed) {
  fill: #b0b0b0;
  transition: fill 0.15s;
}
.node-palette {
  width: 230px;
  background: #fff;
  border: 1px solid #e8e8ec;
  border-radius: 10px;
  padding: 14px;
  overflow-y: auto;
}
.node-palette h4 {
  margin-bottom: 12px;
  color: #555;
  font-size: 13px;
  font-weight: 600;
}
.palette-category {
  font-size: 10px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 14px 0 6px;
  padding: 0 2px;
}
.palette-category:first-of-type {
  margin-top: 0;
}
.palette-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  margin-bottom: 6px;
  border: 1px solid #eef0f2;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s;
}
.palette-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.palette-input:hover { border-color: #4a90d9; background: #f0f6ff; }
.palette-config:hover { border-color: #7b61ff; background: #f4f0ff; }
.palette-ai:hover { border-color: #7b61ff; background: #f4f0ff; }
.palette-transform:hover { border-color: #e8a838; background: #fff8ee; }
.palette-output:hover { border-color: #36b37e; background: #edfaf3; }
.node-icon {
  font-size: 20px;
}
.palette-meta strong {
  font-size: 13px;
  color: #1a1a2e;
}
.palette-meta p {
  font-size: 11px;
  color: #999;
  margin-top: 3px;
  line-height: 1.4;
}
.canvas-area {
  flex: 1;
  background: #fff;
  border: 1px solid #e8e8ec;
  border-radius: 10px;
  overflow: hidden;
}
.vf {
  width: 100%;
  height: 100%;
}
.config-panel {
  width: 300px;
  background: #fff;
  border: 1px solid #e8e8ec;
  border-radius: 10px;
  padding: 16px;
  overflow-y: auto;
}
.config-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f2;
}
.config-icon {
  font-size: 22px;
}
.config-title h4 {
  font-size: 14px;
  color: #1a1a2e;
  margin: 0;
}
.config-type {
  font-size: 10px;
  color: #aaa;
  font-family: monospace;
}
.cfg-group-header {
  font-size: 11px;
  font-weight: 600;
  color: #7a7a8a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 8px;
  padding: 0 2px;
}
.cfg-group-header:first-of-type {
  margin-top: 0;
}
.cfg-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: #f9f9fc;
  border-radius: 8px;
  border: 1px solid #f0f0f4;
  transition: border-color 0.15s;
}
.cfg-row:has(:focus) {
  border-color: #4a90d9;
  background: #f5f9ff;
}
.cfg-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}
.cfg-control {
  width: 100%;
}
.cfg-input,
.cfg-select {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.cfg-input:focus,
.cfg-select:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.12);
}
.cfg-select {
  cursor: pointer;
  appearance: auto;
}
.cfg-textarea {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 11px;
  font-family: monospace;
  resize: vertical;
  color: #333;
  line-height: 1.5;
  background: #fff;
}
.cfg-textarea:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.12);
}
/* 切换开关（Toggle Switch） */
.cfg-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.cfg-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: #ccc;
  border-radius: 10px;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle-track .toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.cfg-toggle input:checked + .toggle-track {
  background: #36b37e;
}
.cfg-toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(16px);
}
.toggle-text {
  font-size: 12px;
  color: #888;
}
.cfg-empty {
  font-size: 12px;
  color: #aaa;
  padding: 12px 0;
  text-align: center;
}
.config-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f2;
}

/* 模型获取按钮 */
.cfg-fetch-btn {
  display: block;
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 6px;
  background: #7b61ff;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.cfg-fetch-btn:hover:not(:disabled) {
  background: #6a4fe0;
}
.cfg-fetch-btn:disabled {
  background: #b8a8ff;
  cursor: wait;
}
.cfg-select-model {
  margin-top: 0;
}
.exec-log {
  margin-top: 12px;
  height: 140px;
  background: #1e1e2e;
  color: #d4d4d4;
  border-radius: 10px;
  padding: 10px 14px;
  overflow-y: auto;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}
.exec-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  color: #fff;
}
.btn-link {
  background: none;
  border: none;
  color: #7ab8ff;
  cursor: pointer;
  font-size: 12px;
}
.log-line {
  line-height: 1.6;
}
.log-empty {
  color: #777;
}

/* ===== 分析详情模态框（可拖拽） ===== */
.analysis-modal {
  position: fixed;
  left: 60px;
  top: 60px;
  width: 520px;
  max-height: 85vh;
  background: #fff;
  border: 1px solid #e0e0ea;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalIn 0.2s ease-out;
}
@keyframes modalIn {
  from { transform: scale(0.96) translateY(8px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
.modal-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  background: #fafafe;
  border-radius: 14px 14px 0 0;
}
.modal-header:active { cursor: grabbing; }
.modal-hd-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal-title { font-size: 14px; font-weight: 600; color: #333; }
.modal-id { font-size: 10px; color: #bbb; font-family: monospace; }
.modal-author { font-size: 11px; color: #7b61ff; font-weight: 500; }
.modal-close {
  width: 28px; height: 28px;
  border: none; background: #f0f0f5; border-radius: 6px;
  cursor: pointer; font-size: 14px; color: #888;
  display: flex; align-items: center; justify-content: center;
}
.modal-close:hover { background: #e4e4ec; color: #555; }
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.md-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.md-card {
  background: #f8f8fc;
  border-radius: 10px;
  padding: 12px;
}
.md-card-full { margin: 0; }
.md-card-prompt {
  background: #f5f0ff;
  border: 1px solid #e4daff;
}
.md-ct { font-size: 12px; font-weight: 600; color: #7b61ff; margin-bottom: 8px; }
.md-ct-row { display: flex; align-items: center; gap: 8px; }
.md-prompt-hint { font-size: 10px; font-weight: 400; color: #aaa; }
.md-scores { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.md-score-lg { font-size: 30px; font-weight: 700; padding: 0 8px; border-radius: 6px; line-height: 1.2; }
.md-sl { font-size: 11px; color: #888; }
.md-ss { font-size: 10px; color: #999; margin-top: 1px; }
.md-meta { display: flex; gap: 10px; font-size: 11px; color: #666; }
.md-dur { margin-left: auto; color: #999; }
.md-row { display: flex; gap: 6px; padding: 3px 0; line-height: 1.6; align-items: baseline; }
.md-lbl { font-size: 10px; color: #999; white-space: nowrap; min-width: 38px; }
.md-val { font-size: 11px; color: #444; flex: 1; }
.md-emotion { color: #d85a30; font-weight: 500; }
.md-tag { font-size: 10px; color: #7b61ff; background: #eae5ff; padding: 0 6px; border-radius: 3px; line-height: 18px; }
.tags-inline { display: flex; gap: 3px; flex-wrap: wrap; }
.md-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.md-tag-li { font-size: 10px; color: #7b61ff; background: #f0edff; padding: 2px 8px; border-radius: 4px; }
.md-prompt-ta {
  width: 100%; min-height: 120px;
  font-size: 12px; line-height: 1.7; color: #333;
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  padding: 10px 12px; resize: vertical;
  font-family: inherit; outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.md-prompt-ta:focus { border-color: #7b61ff; box-shadow: 0 0 0 2px rgba(123,97,255,0.15); }
.md-prompt-ta::placeholder { color: #ccc; }
.md-save-row {
  display: flex; align-items: center; gap: 8px; justify-content: flex-end; margin-top: 8px;
}
.md-save-status { font-size: 11px; color: #888; }
.md-save-btn {
  padding: 5px 14px; font-size: 11px; font-weight: 500;
  background: #7b61ff; color: #fff; border: none; border-radius: 6px;
  cursor: pointer; transition: background 0.12s;
}
.md-save-btn:hover { background: #6a4ff0; }
.md-sug-list { margin: 0; padding: 0 0 0 16px; }
.md-sug-item { font-size: 11px; color: #d85a30; line-height: 1.8; }
.sc-high { background: #e6f7e6; color: #389e38; }
.sc-mid  { background: #fff3cd; color: #b8860b; }
.sc-low  { background: #fcebeb; color: #c0392b; }
</style>
