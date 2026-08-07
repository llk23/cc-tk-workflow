<template>
  <div class="records-page">
    <div class="records-header">
      <div>
        <h2>📋 记录面板</h2>
        <p class="records-sub">汇总所有工作流的运行与调试记录，点击行展开查看原始结果</p>
      </div>
      <div class="records-tools">
        <button class="btn" :disabled="loading" @click="load">
          {{ loading ? '加载中…' : '🔄 刷新' }}
        </button>
        <button class="btn btn-filter" :class="{ active: filter !== 'all' }" @click="cycleFilter">
          筛选：{{ filterLabel }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="records-empty">加载中…</div>
    <div v-else-if="filtered.length === 0" class="records-empty">暂无记录。运行工作流或调试节点后，记录会显示在这里</div>

    <div v-else class="records-table">
      <div class="rt-head">
        <span class="rt-col rt-time">时间</span>
        <span class="rt-col rt-kind">类型</span>
        <span class="rt-col rt-wf">工作流</span>
        <span class="rt-col rt-status">状态</span>
        <span class="rt-col rt-summary">节点摘要</span>
        <span class="rt-col rt-actions">操作</span>
      </div>

      <div v-for="rec in filtered" :key="rec.id" class="rt-row" :class="{ 'rt-open': expandedId === rec.id }">
        <div class="rt-main" @click="toggle(rec.id)">
          <span class="rt-col rt-time">{{ fmtTime(rec.startedAt) }}</span>
          <span class="rt-col rt-kind">
            <span class="kind-badge" :class="rec.kind === 'debug' ? 'kind-debug' : 'kind-run'">
              {{ rec.kind === 'debug' ? '调试' : '运行' }}
            </span>
          </span>
          <span class="rt-col rt-wf">{{ rec.workflowName }}</span>
          <span class="rt-col rt-status">
            <span class="status-dot" :class="`st-${rec.status}`"></span>{{ statusLabel(rec.status) }}
          </span>
          <span class="rt-col rt-summary">
            <span v-for="(n, i) in rec.nodes" :key="i" class="node-tag">{{ n.type }}: {{ n.summary }}</span>
            <span v-if="rec.nodes.length === 0" class="muted">—</span>
          </span>
          <span class="rt-col rt-actions">
            <button class="btn btn-sm" @click.stop="toggle(rec.id)">{{ expandedId === rec.id ? '收起' : '详情' }}</button>
            <button class="btn btn-sm btn-danger" @click.stop="remove(rec)">删除</button>
          </span>
        </div>

        <div v-if="expandedId === rec.id" class="rt-detail">
          <div class="rt-detail-meta">
            <span>ID: {{ rec.id }}</span>
            <span v-if="rec.error" class="err-text">错误: {{ rec.error }}</span>
          </div>
          <div v-for="(output, nodeId) in rec.result" :key="nodeId" class="rt-node-block">
            <div class="rt-node-title">🔹 {{ nodeId }}</div>

            <!-- 视频列表（fetch-tk） -->
            <template v-if="Array.isArray((output as any)?.videos)">
              <div class="rt-video-list">
                <div v-for="(v, vi) in (output as any).videos" :key="vi" class="rt-video">
                  <span class="v-author">@{{ v.author }}</span>
                  <span class="v-stat">▶ {{ fmtNum(v.plays) }} · ❤ {{ fmtNum(v.likes) }}</span>
                  <span class="v-dur" v-if="v.duration">{{ v.duration }}s</span>
                  <span class="v-commerce" v-if="v.isCommerce">🛒 带货</span>
                  <div class="v-desc" v-if="v.desc">{{ v.desc }}</div>
                </div>
              </div>
            </template>

            <!-- 分析结果（ai-analyze / ai-analyze-seedance）：直接展示模型返回的原始内容 -->
            <template v-else-if="Array.isArray((output as any)?.analyses)">
              <div class="rt-video-list">
                <div v-for="(a, ai) in (output as any).analyses" :key="ai" class="rt-analysis">
                  <div class="rt-analysis-head">
                    <span class="v-author" v-if="a.author">@{{ a.author }}</span>
                    <span class="v-stat" v-if="a.videoId">{{ a.videoId }}</span>
                    <span class="v-stat" v-if="a.modelUsed">模型: {{ a.modelUsed }}</span>
                    <span class="v-stat" v-if="a.analyzedAt">{{ fmtTime(a.analyzedAt) }}</span>
                    <span class="v-stat" v-if="a.error">⚠ {{ a.error }}</span>
                  </div>
                  <!-- 模型返回什么就展示什么 -->
                  <pre class="rt-raw">{{ renderRaw(a.rawOutput) }}</pre>
                </div>
              </div>
            </template>

            <!-- 普通输出 -->
            <template v-else>
              <pre class="rt-json">{{ pretty(output) }}</pre>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { workflowApi } from '@/api'

interface RecordItem {
  id: string
  workflowId: string
  workflowName: string
  kind: 'run' | 'debug'
  status: string
  progress: number
  error?: string | null
  startedAt?: string
  completedAt?: string | null
  nodes: Array<{ nodeId: string; type: string; summary: string }>
  result: Record<string, any>
}

const loading = ref(false)
const records = ref<RecordItem[]>([])
const expandedId = ref<string | null>(null)
const filter = ref<'all' | 'run' | 'debug'>('all')

const filterLabel = computed(() => ({ all: '全部', run: '仅运行', debug: '仅调试' })[filter.value])
const filtered = computed(() =>
  filter.value === 'all' ? records.value : records.value.filter((r) => r.kind === filter.value),
)

async function load() {
  loading.value = true
  try {
    const res = await workflowApi.records()
    records.value = Array.isArray(res.data) ? res.data : []
  } catch (e: any) {
    alert('加载失败: ' + (e?.message || e))
  }
  loading.value = false
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function cycleFilter() {
  filter.value = filter.value === 'all' ? 'run' : filter.value === 'run' ? 'debug' : 'all'
}

async function remove(rec: RecordItem) {
  if (!window.confirm(`确认删除这条${rec.kind === 'debug' ? '调试' : '运行'}记录？\n${rec.id}`)) return
  try {
    await workflowApi.removeRecord(rec.id)
    records.value = records.value.filter((r) => r.id !== rec.id)
    if (expandedId.value === rec.id) expandedId.value = null
  } catch (e: any) {
    alert('删除失败: ' + (e?.message || e))
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function statusLabel(s: string): string {
  return ({ pending: '等待', queued: '排队', running: '执行中', completed: '完成', failed: '失败' } as any)[s] || s
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 10_000).toFixed(1) + 'W'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
function pretty(o: unknown): string {
  try { return JSON.stringify(o, null, 2) } catch { return String(o) }
}

/** 模型返回的原始内容：CLI JSON 消息流提取最终 result；普通 JSON 格式化；自然语言原文展示 */
function renderRaw(raw?: string): string {
  if (!raw) return '（无分析结果）'
  const trimmed = raw.trim()
  // WorkBuddy Agent：rawOutput 是 CLI JSON 消息数组，提取最后一条 type=result 的 result
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) {
        const results = arr.filter((m: any) => m?.type === 'result' && m?.result)
        if (results.length) return String(results[results.length - 1].result)
        const texts = arr.filter((m: any) => m?.type === 'text' && m?.text)
        if (texts.length) return String(texts[texts.length - 1].text)
      }
    } catch { /* 截断/损坏，走下方截断展示 */ }
    // 解析失败（可能是列表接口截断的片段）：只展示前 2000 字符，避免巨型乱码
    return raw.slice(0, 2000) + (raw.length > 2000 ? '\n…（内容过长已截断）' : '')
  }
  // 普通 JSON 则格式化
  if (trimmed.startsWith('{')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      return raw
    }
  }
  return raw
}

onMounted(load)
</script>

<style scoped>
.records-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 0 32px;
}
.records-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}
.records-header h2 { font-size: 20px; color: #1a1a2e; }
.records-sub { font-size: 12px; color: #888; margin-top: 4px; }
.records-tools { display: flex; gap: 8px; }

.btn {
  border: 1px solid #d0d0d8;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) { border-color: #4a90d9; color: #4a90d9; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-filter.active { background: #4a90d9; color: #fff; border-color: #4a90d9; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
.btn-danger { color: #e5484d; }
.btn-danger:hover:not(:disabled) { border-color: #e5484d; color: #e5484d; }

.records-empty {
  text-align: center;
  color: #999;
  padding: 60px 0;
  font-size: 14px;
}

.records-table {
  background: #fff;
  border: 1px solid #e8e8ee;
  border-radius: 10px;
  overflow: hidden;
}
.rt-head, .rt-main {
  display: grid;
  grid-template-columns: 150px 60px 1fr 80px 2fr 120px;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
}
.rt-head {
  background: #f7f8fb;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  border-bottom: 1px solid #eee;
}
.rt-row {
  border-bottom: 1px solid #f2f2f6;
}
.rt-row:last-child { border-bottom: none; }
.rt-main {
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s;
}
.rt-main:hover { background: #fafbff; }
.rt-row.rt-open .rt-main { background: #f0f4ff; }

.rt-col { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-time { color: #666; font-size: 12px; }
.rt-wf { color: #333; font-weight: 500; }

.kind-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 18px;
}
.kind-run { background: #e6f1fb; color: #185fa5; }
.kind-debug { background: #fbeaf0; color: #993556; }

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.st-completed { background: #36b37e; }
.st-failed { background: #e5484d; }
.st-running, .st-queued, .st-pending { background: #f0a020; }

.rt-summary { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
.node-tag {
  background: #f2f2f7;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  color: #555;
  white-space: nowrap;
}
.muted { color: #bbb; }
.rt-actions { display: flex; gap: 6px; }

.rt-detail {
  padding: 12px 16px;
  background: #fafbff;
  border-top: 1px solid #eef0f6;
}
.rt-detail-meta {
  font-size: 11px;
  color: #999;
  font-family: monospace;
  margin-bottom: 10px;
  display: flex;
  gap: 16px;
}
.err-text { color: #e5484d; }
.rt-node-block { margin-bottom: 12px; }
.rt-node-title {
  font-size: 12px;
  font-weight: 500;
  color: #4a90d9;
  margin-bottom: 6px;
}
.rt-video-list {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 8px 12px;
}
.rt-video {
  padding: 6px 0;
  border-bottom: 1px solid #f5f5f8;
  font-size: 12px;
}
.rt-video:last-child { border-bottom: none; }
.v-author { color: #7b61ff; font-weight: 500; margin-right: 10px; }
.v-stat { color: #555; margin-right: 10px; }
.v-dur, .v-commerce { color: #999; margin-right: 10px; }
.v-desc { color: #777; margin-top: 3px; line-height: 1.5; }
.v-tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.tag {
  background: #f0f0f8;
  color: #666;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.rt-json {
  background: #f8f8fb;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: #444;
  max-height: 240px;
  overflow: auto;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ===== 分析结果（模型原始输出直显） ===== */
.rt-analysis {
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f8;
}
.rt-analysis:last-child { border-bottom: none; }
.rt-analysis-head {
  font-size: 12px;
  margin-bottom: 4px;
}
.rt-raw {
  background: #f8f8fb;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #333;
  max-height: 480px;
  overflow: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  margin: 0;
}
</style>
