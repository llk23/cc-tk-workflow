<template>
  <div class="workflow-editor">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <h2>工作流编辑器</h2>
      <div class="toolbar-actions">
        <input v-model="store.workflowName" class="wf-name" placeholder="工作流名称" />
        <button class="btn" @click="save">💾 保存</button>
        <button class="btn" @click="loadPrompt">📂 加载</button>
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
        <div
          v-for="node in availableNodes"
          :key="node.type"
          class="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, node)"
        >
          <span class="node-icon">{{ node.icon }}</span>
          <div>
            <strong>{{ node.label }}</strong>
            <p>{{ node.description }}</p>
          </div>
        </div>
      </aside>

      <!-- 中间画布 -->
      <div class="canvas-area" @drop="onDrop" @dragover.prevent>
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes"
          :delete-key-code="null"
          @node-click="onNodeClick"
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
        <h4>节点配置 — {{ selectedNode.data.label }}</h4>
        <div v-if="configEntries.length === 0" class="cfg-empty">
          该节点暂无可配置项
        </div>
        <div v-for="([key, val], i) in configEntries" :key="i" class="cfg-row">
          <label>{{ key }}</label>
          <input :value="String(val)" @input="onCfgInput(key, $event)" />
        </div>
        <button class="btn btn-danger" @click="deleteNode(store.selectedNodeId!)">🗑 删除节点</button>
        <button class="btn" @click="store.setSelected(null)">关闭</button>
      </aside>
    </div>

    <!-- 底部执行日志 -->
    <div class="exec-log">
      <div class="exec-log-header">
        <strong>执行日志</strong>
        <button class="btn-link" @click="store.clearLogs()">清空</button>
      </div>
      <div v-for="(l, i) in store.logs" :key="i" class="log-line">{{ l }}</div>
      <div v-if="store.logs.length === 0" class="log-empty">暂无日志，点击「运行」开始</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useWorkflowStore } from '@/stores/workflow'
import { workflowApi } from '@/api'
import CustomNode from '@/components/CustomNode.vue'
import { useExecutionSocket } from '@/composables/useExecutionSocket'

const store = useWorkflowStore()
const { nodes, edges, addNodes, addEdges, onConnect, updateNodeData, findNode, setNodes, setEdges, removeNodes, removeEdges, screenToFlowCoordinate } =
  useVueFlow()

const nodeTypes = { custom: CustomNode } as any

const availableNodes = [
  { type: 'fetch-tk', label: 'TK 视频抓取', icon: '📥', description: '从 TK 抓取视频' },
  { type: 'ai-analyze', label: 'AI 视频分析', icon: '🧠', description: '多模态 AI 分析' },
  { type: 'video-generate', label: 'AI 视频生成', icon: '🎬', description: '生成新视频' },
  { type: 'transform', label: '数据转换', icon: '🔄', description: '格式转换/过滤' },
  { type: 'condition', label: '条件判断', icon: '🔀', description: '条件分支路由' },
  { type: 'output', label: '结果输出', icon: '📤', description: '保存/通知' },
]

function defaultConfig(nodeType: string): Record<string, unknown> {
  switch (nodeType) {
    case 'fetch-tk':
      return { source: 'tiktok', keyword: '', maxVideos: 10 }
    case 'ai-analyze':
      return { model: 'gpt-4v', extractHooks: true }
    case 'video-generate':
      return { tool: 'runway', durationSec: 15 }
    default:
      return {}
  }
}

// 拖拽添加节点
function onDragStart(event: DragEvent, node: { type: string; label: string }) {
  event.dataTransfer?.setData('application/vueflow', JSON.stringify(node))
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('application/vueflow')
  if (!raw) return
  const node = JSON.parse(raw) as { type: string; label: string }
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const id = `${node.type}_${Date.now()}`
  pushHistory()
  addNodes([
    {
      id,
      type: 'custom',
      position,
      data: { label: node.label, nodeType: node.type, config: defaultConfig(node.type), status: 'idle' },
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

// 点击画布空白处取消选中
function onPaneClick() {
  store.setSelected(null)
}

// 键盘 Delete / Backspace 删除选中节点（输入框内不触发）
function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedNodeId) {
    e.preventDefault()
    deleteNode(store.selectedNodeId)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// 选中节点 → 打开配置面板
function onNodeClick(event: { node: { id: string } }) {
  store.setSelected(event.node.id)
}
const selectedNode = computed(() => (store.selectedNodeId ? findNode(store.selectedNodeId) : null))
const configEntries = computed<Array<[string, any]>>(() => {
  const cfg = selectedNode.value?.data.config
  return cfg ? Object.entries(cfg) : []
})

// 配置面板输入写回节点 data
function onCfgInput(key: string, e: Event) {
  if (!store.selectedNodeId) return
  const value = (e.target as HTMLInputElement).value
  const node = findNode(store.selectedNodeId)
  const config = { ...(node?.data.config || {}), [key]: value }
  updateNodeData(store.selectedNodeId, { config })
}

// 保存 / 加载
async function save() {
  const payload = {
    name: store.workflowName,
    description: '',
    status: 'active',
    trigger: { type: 'manual' },
    nodes: nodes.value.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      position: n.position,
      config: n.data.config,
    })),
    edges: edges.value.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }
  const res = await workflowApi.create(payload)
  store.currentWorkflowId = res.data.id
  store.addLog('工作流已保存：' + res.data.id)
}
function loadPrompt() {
  const id = window.prompt('输入工作流 ID 加载：')
  if (id) load(id)
}
async function load(id: string) {
  const res = await workflowApi.get(id)
  const wf = res.data
  store.currentWorkflowId = wf.id
  store.workflowName = wf.name
  setNodes(
    (wf.nodes || []).map((n: any) => ({
      id: n.id,
      type: 'custom',
      position: n.position,
      data: { label: n.label, nodeType: n.type, config: n.config || {}, status: 'idle' },
    })),
  )
  setEdges((wf.edges || []).map((e: any) => ({ id: e.id, source: e.source, target: e.target })))
  store.addLog('已加载工作流：' + wf.id)
}

// 运行（先保存，再连 WS 收进度）
async function run() {
  if (!store.currentWorkflowId) await save()
  store.clearLogs()
  store.running = true
  const res = await workflowApi.execute(store.currentWorkflowId!)
  const executionId = res.data.executionId
  store.addLog('已提交执行，executionId=' + executionId)

  // 重置所有节点状态
  nodes.value.forEach((n) => updateNodeData(n.id, { status: 'idle' }))

  const sock = useExecutionSocket()
  sock.connect(executionId, (evt) => {
    if (evt.nodeId) {
      if (evt.type === 'node:start') updateNodeData(evt.nodeId, { status: 'running' })
      else if (evt.type === 'node:success') updateNodeData(evt.nodeId, { status: 'success' })
      else if (evt.type === 'node:failed') updateNodeData(evt.nodeId, { status: 'failed' })
    }
    store.addLog(evt.message || evt.type)
    if (evt.type === 'completed' || evt.type === 'failed') store.running = false
  })
}
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 110px);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.toolbar h2 {
  color: #1a1a2e;
  font-size: 18px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.wf-name {
  padding: 7px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  width: 180px;
}
.btn {
  padding: 7px 14px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn:hover {
  border-color: #4a90d9;
}
.btn:disabled {
  background: #f5f5f5;
  color: #bbb;
  cursor: not-allowed;
  border-color: #e0e0e0;
}
.btn-run {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}
.btn-run:disabled {
  background: #9bbfe0;
  cursor: not-allowed;
}
.btn-danger {
  margin-top: 12px;
  color: #e5484d;
  border-color: #f3c2c4;
}
.editor-layout {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.node-palette {
  width: 230px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 14px;
  overflow-y: auto;
}
.node-palette h4 {
  margin-bottom: 10px;
  color: #555;
  font-size: 13px;
}
.palette-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s;
}
.palette-item:hover {
  border-color: #4a90d9;
  background: #f0f6ff;
}
.node-icon {
  font-size: 20px;
}
.palette-item strong {
  font-size: 13px;
}
.palette-item p {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}
.canvas-area {
  flex: 1;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}
.vf {
  width: 100%;
  height: 100%;
}
.config-panel {
  width: 260px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 14px;
  overflow-y: auto;
}
.config-panel h4 {
  margin-bottom: 12px;
  font-size: 13px;
  color: #333;
}
.cfg-row {
  margin-bottom: 10px;
}
.cfg-row label {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
}
.cfg-row input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  font-size: 13px;
}
.cfg-empty {
  font-size: 12px;
  color: #aaa;
}
.exec-log {
  margin-top: 12px;
  height: 140px;
  background: #1e1e2e;
  color: #d4d4d4;
  border-radius: 8px;
  padding: 10px 14px;
  overflow-y: auto;
  font-family: monospace;
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
</style>
