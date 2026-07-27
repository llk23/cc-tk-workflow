<template>
  <div class="wf-node-wrap">
    <div
      class="wf-node"
      :class="[`wf-type-${data.nodeType}`, `status-${data.status || 'idle'}`]"
    >
      <Handle type="target" :position="Position.Left" />
      <div class="wf-node-body">
        <div class="wf-node-header">
          <span class="wf-icon">{{ icon }}</span>
          <span class="wf-label">{{ data.label }}</span>
        </div>
        <div class="wf-node-type">{{ data.nodeType }}</div>
      </div>
      <div v-if="data.status === 'running'" class="wf-pulse"></div>
      <div v-else-if="data.status === 'success'" class="wf-badge">✓</div>
      <div v-else-if="data.status === 'failed'" class="wf-badge wf-badges-err">✗</div>
      <Handle type="source" :position="Position.Right" />

      <!-- fetch-tk：历史展开按钮 -->
      <button
        v-if="data.nodeType === 'fetch-tk'"
        class="wf-history-btn"
        @click.stop="toggleHistory"
        :title="historyOpen ? '收起历史' : '查看历史抓取记录'"
      >{{ historyOpen ? '▾' : '▸' }}</button>

      <!-- ai-analyze：结果展开按钮（在 .wf-node 内部，position:relative 生效） -->
      <button
        v-if="data.nodeType === 'ai-analyze'"
        class="wf-history-btn"
        @click.stop="toggleAiHistory"
        :title="aiOpen ? '收起分析结果' : '查看分析结果'"
      >{{ aiOpen ? '▾' : '▸' }}</button>
    </div>

    <!-- fetch-tk：历史记录下拉区域 -->
    <div v-if="historyOpen" class="wf-history-drop" @click.stop>
      <div v-if="loading" class="wh-loading">加载中…</div>
      <div v-else-if="records.length === 0" class="wh-empty">暂无历史记录</div>
      <template v-else>
        <div v-for="(rec, ri) in records" :key="ri" class="wh-rec">
          <div class="wh-rec-hd" @click="rec._open = !rec._open">
            <span class="wh-keyword">{{ rec.keyword }}</span>
            <span class="wh-meta">{{ rec.total }}条 · {{ rec.time }}</span>
            <span class="wh-arrow">{{ rec._open ? '▾' : '▸' }}</span>
          </div>
          <div v-if="rec._open" class="wh-rec-bd">
            <div v-for="(v, vi) in rec.videos" :key="vi" class="wh-video">
              <div class="wh-v-top">
                <span class="wh-author">@{{ v.author }}</span>
                <span class="wh-stat">▶ {{ fmtNum(v.plays) }} · ❤ {{ fmtNum(v.likes) }}</span>
                <span class="wh-dur" v-if="v.duration">{{ v.duration }}s</span>
              </div>
              <div class="wh-desc" v-if="v.desc">{{ truncate(v.desc, 90) }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ai-analyze：历史分析结果下拉面板 (3级下钻) -->
    <div v-if="aiOpen" class="wf-ai-drop" @click.stop>
      <div v-if="aiLoading" class="wh-loading">加载中…</div>
      <div v-else-if="aiRecords.length === 0" class="wh-empty">暂无历史分析记录</div>

      <!-- ===== Lv1: 分析记录列表 ===== -->
      <template v-else>
        <!-- 面包屑 -->
        <div v-if="aiDetailRec !== null" class="ai-bread" @click="aiDetailRec = null; aiDetailIdx = null">
          <span class="ai-bread-back">← 返回</span>
          <span class="ai-bread-sep">/</span>
          <span class="ai-bread-cur">分析记录</span>
        </div>

        <div v-for="(rec, ri) in aiRecords" :key="ri">
          <!-- Lv1 行 -->
          <div v-if="aiDetailRec === null" class="ai-rec-hd" @click="rec._open = !rec._open">
            <span class="ai-rec-time">{{ rec.time }}</span>
            <span class="ai-rec-mode">{{ rec.mode }}</span>
            <span class="ai-rec-meta">{{ rec.total }} 个视频</span>
            <span class="wh-arrow">{{ rec._open ? '▾' : '▸' }}</span>
          </div>

          <!-- Lv2: 视频卡片列表（点击进入详情 -> 触发右侧抽屉） -->
          <div v-if="rec._open && aiDetailRec === null" class="ai-rec-bd">
            <div v-for="(a, ai) in rec.analyses" :key="ai"
              class="ai-vid-card"
              @click="openDetailDrawer(a, rec.analyses, ai)">
              <!-- 封面图 -->
              <div class="ai-vid-cover-wrap">
                <div class="ai-vid-cover-fallback">
                  <span class="ai-vid-fb-icon">▶</span>
                </div>
                <span class="ai-vid-dur" v-if="a.duration">{{ a.duration > 60 ? Math.floor(a.duration/60)+':'+String(a.duration%60).padStart(2,'0') : a.duration+'s' }}</span>
              </div>
              <!-- 右侧内容 -->
              <div class="ai-vid-body">
                <!-- 第一行：评分 + 统计数据 -->
                <div class="ai-vid-top">
                  <span class="ai-vid-score" :class="scoreClass(a.qualityScore)">{{ a.qualityScore }}</span>
                  <span class="ai-vid-score" :class="scoreClass(a.hookRating)">钩{{ a.hookRating }}</span>
                  <span class="ai-vid-label">{{ a.styleCategory?.split('|')[0] || 'other' }}</span>
                  <span class="ai-vid-stats">▶ {{ fmtNum(a.plays) }} · ❤ {{ fmtNum(a.likes) }}</span>
                </div>
                <!-- 作者 -->
                <div class="ai-vid-author" v-if="a.author">@{{ a.author }}</div>
                <!-- 描述 -->
                <div class="ai-vid-desc" v-if="a.description">{{ truncate(a.description, 60) }}</div>
                <!-- 底部：标签 + 链接 -->
                <div class="ai-vid-footer">
                  <span v-for="(t, ti) in (a.generatedTags || []).slice(0, 3)" :key="ti" class="ai-vid-tag">{{ t }}</span>
                  <a v-if="a.author && a.videoId"
                    :href="'https://www.tiktok.com/@' + a.author + '/video/' + a.videoId"
                    target="_blank"
                    class="ai-vid-link"
                    @click.stop
                    title="打开 TikTok">↗</a>
                </div>
              </div>
              <!-- 点击进入箭头 -->
              <span class="ai-vid-enter">›</span>
            </div>
          </div>
        </div>

        <!-- Lv3 独立展示在右侧抽屉中，不在此处渲染 -->
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import axios from 'axios'

const props = defineProps<{ data: any; id: string }>()

// 从父级注入的方法：打开视频详情抽屉
const openAnalysisDetail = inject<(video: any, allAnalyses: any[], index: number) => void>('openAnalysisDetail', () => {})

const iconMap: Record<string, string> = {
  'fetch-tk': '📥',
  'tk-account-verify': '🔐',
  'ai-analyze': '🧠',
  'video-generate': '🎬',
  transform: '🔄',
  condition: '🔀',
  output: '📤',
}
const icon = iconMap[props.data.nodeType] || '⚙️'

// ===== ai-analyze 历史分析记录 (3级下钻) =====
const aiOpen = ref(false)
const aiLoading = ref(false)
const aiDetailRec = ref<number | null>(null)
const aiDetailIdx = ref<number | null>(null)
const aiRecords = ref<Array<{
  time: string
  mode: string
  total: number
  analyses: Array<{
    videoId: string
    qualityScore: number
    hookRating: number
    styleCategory: string
    captionStructure?: string
    targetAudience?: string[]
    suggestions: string[]
    generatedTags: string[]
    rawOutput?: string
  }>
  _open: boolean
}>>([])

const aiDetailVideo = computed(() => {
  if (aiDetailRec.value === null || aiDetailIdx.value === null) return null
  const rec = aiRecords.value[aiDetailRec.value]
  if (!rec) return null
  return rec.analyses[aiDetailIdx.value] || null
})

const parsedDetail = computed(() => {
  const v = aiDetailVideo.value
  if (!v?.rawOutput) return null
  try { return JSON.parse(v.rawOutput) } catch { return null }
})

// 可编辑的生成提示词
const editedPrompt = ref('')

// 当切换到新视频时，同步 editedPrompt
watch(aiDetailVideo, (v) => {
  if (v?.rawOutput) {
    try {
      const p = JSON.parse(v.rawOutput)
      editedPrompt.value = p?.replication?.generationPrompt || ''
    } catch {
      editedPrompt.value = ''
    }
  } else {
    editedPrompt.value = ''
  }
})

async function toggleAiHistory() {
  aiOpen.value = !aiOpen.value
  if (!aiOpen.value || aiRecords.value.length > 0) return
  aiLoading.value = true
  try {
    const res = await axios.get('/api/workflows', { timeout: 5000 })
    const workflows: Array<any> = Array.isArray(res.data) ? res.data : []
    const wf = workflows.find((w: any) =>
      (w.nodes || []).some((n: any) => n.id === props.id)
    )
    if (!wf) { aiLoading.value = false; return }

    const histRes = await axios.get(`/api/workflows/${wf.id}/history`, { timeout: 8000 })
    const list: Array<any> = Array.isArray(histRes.data) ? histRes.data : []

    for (const exec of list) {
      if (exec.status !== 'completed') continue
      const allResults = exec.result as Record<string, any> | undefined
      if (!allResults) continue

      let output = allResults[props.id]
      if (!output?.analyses?.length) {
        for (const v of Object.values(allResults)) {
          const o = (v as any)
          output = o?.data?.[props.id] || o?.[props.id]
          if (output?.analyses?.length) break
          if (o?.analyses?.length) { output = o; break }
        }
      }
      if (!output?.analyses?.length) continue

      aiRecords.value.push({
        time: formatTime(exec.startedAt),
        mode: output.analysisMode || 'video',
        total: output.total || output.analyses.length,
        analyses: output.analyses.map((a: any) => ({
          videoId: a.videoId || '',
          qualityScore: a.qualityScore ?? 0,
          hookRating: a.hookRating ?? 0,
          styleCategory: a.styleCategory || 'other',
          captionStructure: a.captionStructure,
          targetAudience: a.targetAudience || [],
          suggestions: a.suggestions || [],
          generatedTags: a.generatedTags || [],
          rawOutput: a.rawOutput || '',
          // 视频元数据
          author: a.author || '',
          description: a.description || '',
          plays: a.plays ?? 0,
          likes: a.likes ?? 0,
          comments: a.comments ?? 0,
          duration: a.duration ?? 0,
          coverUrl: a.coverUrl || '',
          isCommerce: !!a.isCommerce,
        })),
        _open: false,
      })
    }
    aiRecords.value = aiRecords.value.slice(0, 20)
  } catch { /* ignore */ }
  aiLoading.value = false
}

function openDetailDrawer(video: any, allAnalyses: any[], index: number) {
  openAnalysisDetail(video, allAnalyses, index)
}

function scoreClass(s: number): string {
  if (s >= 8) return 'sc-high'
  if (s >= 6) return 'sc-mid'
  return 'sc-low'
}

// ===== fetch-tk 历史记录 =====
const historyOpen = ref(false)
const loading = ref(false)
const records = ref<Array<{
  keyword: string
  total: number
  time: string
  videos: Array<{ id: string; author: string; desc: string; plays: number; likes: number; duration?: number }>
  _open: boolean
}>>([])

async function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (!historyOpen.value || records.value.length > 0) return
  loading.value = true
  try {
    const res = await axios.get('/api/workflows', { timeout: 5000 })
    const workflows: Array<any> = Array.isArray(res.data) ? res.data : []
    const wf = workflows.find((w: any) =>
      (w.nodes || []).some((n: any) => n.id === props.id)
    )
    if (!wf) { loading.value = false; return }

    const histRes = await axios.get(`/api/workflows/${wf.id}/history`, { timeout: 8000 })
    const list: Array<any> = Array.isArray(histRes.data) ? histRes.data : []
    const result: typeof records.value = []

    for (const exec of list) {
      if (exec.status !== 'completed') continue
      const allResults = exec.result as Record<string, any> | undefined
      if (!allResults) continue

      // 尝试两种格式提取当前节点的输出：
      //   新格式: { "fetch-tk_xxx": { videos, ... } }
      //   旧格式: { "output_xxx": { data: { "fetch-tk_xxx": { videos, ... } } } }
      let output = allResults[props.id]
      if (!output?.videos?.length) {
        // 旧格式兜底：遍历每个顶层 key，找 data[props.id] 或下级 [props.id]
        for (const v of Object.values(allResults)) {
          const o = (v as any)
          output = o?.data?.[props.id] || o?.[props.id]
          if (output?.videos?.length) break
        }
      }
      if (!output?.videos?.length) continue

      result.push({
        keyword: output.keyword || '—',
        total: output.total || output.videos.length,
        time: formatTime(exec.startedAt),
        videos: output.videos.map((v: any) => ({
          id: v.id,
          author: v.author || '?',
          desc: v.desc || '',
          plays: v.plays ?? 0,
          likes: v.likes ?? 0,
          duration: v.duration,
        })),
        _open: false,
      })
    }
    records.value = result.slice(0, 20)
  } catch { /* ignore */ }
  loading.value = false
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 10_000).toFixed(1) + 'W'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}
function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.wf-node-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.wf-node {
  position: relative;
  border: 2px solid #d0d0d0;
  border-radius: 10px;
  padding: 10px 14px;
  background: #fff;
  min-width: 160px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.wf-node-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wf-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wf-icon { font-size: 18px; }
.wf-label {
  font-weight: 600;
  color: #1a1a2e;
  font-size: 13px;
}
.wf-node-type {
  font-size: 10px;
  color: #999;
  font-family: monospace;
  margin-left: 26px;
}

/* 类型色彩编码 */
.wf-type-fetch-tk { border-left: 3px solid #4a90d9; }
.wf-type-tk-account-verify { border-left: 3px solid #4a90d9; }
.wf-type-ai-analyze { border-left: 3px solid #7b61ff; }
.wf-type-video-generate { border-left: 3px solid #7b61ff; }
.wf-type-transform { border-left: 3px solid #e8a838; }
.wf-type-condition { border-left: 3px solid #e8a838; }
.wf-type-output { border-left: 3px solid #36b37e; }

/* 执行状态 */
.status-running {
  border-color: #f0a020;
  box-shadow: 0 0 0 3px #ffe8b3;
}
.status-success {
  border-color: #36b37e;
  box-shadow: 0 0 0 3px #d3f4e0;
}
.status-failed {
  border-color: #e5484d;
  box-shadow: 0 0 0 3px #fbd5d6;
}

/* 运行脉冲动画 */
.wf-pulse {
  position: absolute;
  right: 8px;
  top: 50%;
  margin-top: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f0a020;
  animation: pulse 0.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}

/* 成功/失败标记 */
.wf-badge {
  position: absolute;
  right: 8px;
  top: 50%;
  margin-top: -8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #36b37e;
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}
.wf-badges-err {
  background: #e5484d;
}

/* ===== 历史展开按钮 ===== */
.wf-history-btn {
  position: absolute;
  right: 6px;
  bottom: 4px;
  width: 18px;
  height: 18px;
  border: none;
  background: #eef1f8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  padding: 0;
  color: #667;
  transition: background 0.15s;
}
.wf-history-btn:hover {
  background: #dce1ec;
}

/* ===== 历史下拉区域 ===== */
.wf-history-drop {
  margin-top: 2px;
  width: 280px;
  max-height: 360px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #dde;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
}
.wh-loading, .wh-empty {
  padding: 14px 12px;
  text-align: center;
  font-size: 12px;
  color: #999;
}
.wh-rec {
  border-bottom: 1px solid #f0f0f4;
}
.wh-rec:last-child {
  border-bottom: none;
}
.wh-rec-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;
}
.wh-rec-hd:hover {
  background: #f7f8fc;
}
.wh-keyword {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wh-meta {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}
.wh-arrow {
  font-size: 11px;
  color: #aaa;
  width: 14px;
  text-align: center;
}
.wh-rec-bd {
  padding: 0 10px 8px;
  border-top: 1px solid #f5f5f8;
}
.wh-video {
  padding: 6px 0;
  border-bottom: 1px solid #f8f8fb;
}
.wh-video:last-child {
  border-bottom: none;
}
.wh-v-top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.wh-author {
  color: #7b61ff;
  font-weight: 500;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wh-stat {
  color: #666;
  white-space: nowrap;
}
.wh-dur {
  color: #999;
  margin-left: auto;
}
.wh-desc {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
  line-height: 1.4;
}

/* ===== ai-analyze 结果下拉 ===== */
.wf-ai-drop {
  margin-top: 2px;
  width: 290px;
  max-height: 400px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #dde;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
}
.ai-summary {
  padding: 8px 12px;
  font-size: 11px;
  color: #7b61ff;
  font-weight: 500;
  border-bottom: 1px solid #f0f0f4;
}
.ai-card {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f4;
}
.ai-card:last-child {
  border-bottom: none;
}
.ai-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.ai-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
.ai-id {
  font-size: 10px;
  color: #bbb;
  font-family: monospace;
}
.ai-scores {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.ai-score {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 4px;
}
.sc-high { background: #e6f7e6; color: #389e38; }
.sc-mid  { background: #fff3cd; color: #b8860b; }
.sc-low  { background: #fcebeb; color: #c0392b; }
.ai-label-tag {
  font-size: 10px;
  color: #7b61ff;
  background: #f0edff;
  padding: 1px 6px;
  border-radius: 3px;
}
.ai-row {
  display: flex;
  gap: 8px;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 3px;
}
.ai-k {
  color: #999;
  white-space: nowrap;
  min-width: 28px;
}
.ai-v {
  color: #444;
  flex: 1;
}
.ai-sug-row .ai-v {
  color: #d85a30;
}
.ai-sug-text {
  color: #d85a30;
}

/* ===== ai-analyze 3级下钻 ===== */
.wf-ai-drop {
  margin-top: 2px;
  width: 300px;
  max-height: 460px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e0ea;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
  z-index: 100;
  font-size: 12px;
}

/* 面包屑 */
.ai-bread {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f5;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  background: #fafafe;
  border-radius: 10px 10px 0 0;
}
.ai-bread:hover { background: #f5f5fb; }
.ai-bread-back { font-size: 12px; color: #7b61ff; font-weight: 500; }
.ai-bread-sep { color: #ccc; font-size: 11px; }
.ai-bread-cur { color: #888; font-size: 11px; }

/* ===== Lv1: 记录行 ===== */
.ai-rec-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;
  border-bottom: 1px solid #f5f5fa;
}
.ai-rec-hd:hover { background: #f7f8fc; }
.ai-rec-time { font-size: 11px; color: #888; white-space: nowrap; min-width: 75px; }
.ai-rec-mode { font-size: 10px; color: #7b61ff; background: #f0edff; padding: 1px 6px; border-radius: 4px; }
.ai-rec-meta { flex: 1; font-size: 11px; color: #666; text-align: right; }

/* ===== Lv2: 视频卡片 ===== */
.ai-rec-bd { padding: 4px 6px 8px; border-bottom: 1px solid #f2f2f7; }
.ai-vid-card {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  margin-top: 2px;
  position: relative;
}
.ai-vid-card:hover { background: #f7f8fc; }
.ai-vid-cover-wrap {
  position: relative;
  width: 56px;
  min-height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: #f2f2f7;
  flex-shrink: 0;
}
.ai-vid-cover {
  width: 56px;
  height: 72px;
  object-fit: cover;
  display: block;
}
.ai-vid-cover-fallback {
  width: 56px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8e8f0;
}
.ai-vid-fb-icon { font-size: 18px; color: #bbb; }
.ai-vid-dur {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 9px;
  color: #fff;
  background: rgba(0,0,0,0.6);
  padding: 0 4px;
  border-radius: 3px;
  line-height: 14px;
}
.ai-vid-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ai-vid-top {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.ai-vid-score {
  font-size: 10px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
}
.ai-vid-label {
  font-size: 9px;
  color: #7b61ff;
  background: #f0edff;
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
}
.ai-vid-stats {
  font-size: 9px;
  color: #999;
  margin-left: auto;
  white-space: nowrap;
}
.ai-vid-author {
  font-size: 10px;
  color: #7b61ff;
  font-weight: 500;
}
.ai-vid-desc {
  font-size: 10px;
  color: #666;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ai-vid-footer {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
  margin-top: auto;
}
.ai-vid-tag {
  font-size: 9px;
  color: #888;
  background: #f3f3f8;
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
}
.ai-vid-link {
  font-size: 13px;
  color: #7b61ff;
  text-decoration: none;
  margin-left: auto;
  padding: 0 2px;
  line-height: 16px;
}
.ai-vid-link:hover { color: #534ab7; }
.ai-vid-enter {
  position: absolute;
  right: 4px;
  top: 50%;
  margin-top: -8px;
  font-size: 16px;
  color: #ccc;
}

/* ===== Lv3: 视频详情（双栏紧凑布局） ===== */
.ai-detail { padding: 0; }
.ai-detail-hd {
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-detail-num { font-size: 14px; font-weight: 600; color: #333; }
.ai-detail-id { font-size: 10px; color: #bbb; font-family: monospace; }
.ai-detail-author { font-size: 11px; color: #7b61ff; font-weight: 500; margin-left: auto; }

/* 双栏网格 */
.ai-detail-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 6px 10px;
}
.ai-detail-card {
  background: #f8f8fc;
  border-radius: 8px;
  padding: 10px;
}
.ai-detail-card-full {
  margin: 0 10px 6px;
}
.ai-detail-card-prompt {
  background: #f5f0ff;
  border: 1px solid #e4daff;
}
.ai-dc-title {
  font-size: 11px;
  font-weight: 600;
  color: #7b61ff;
  margin-bottom: 6px;
}
.ai-dc-title-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ai-prompt-hint {
  font-size: 10px;
  font-weight: 400;
  color: #aaa;
}
.ai-dc-scores {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ai-ds-val-lg {
  font-size: 28px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 6px;
  line-height: 1.2;
}
.ai-ds-sub { font-size: 10px; color: #999; margin-top: 1px; }
.ai-dc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #666;
}
.ai-dc-dur { margin-left: auto; color: #999; }
.ai-dc-row {
  display: flex;
  gap: 6px;
  padding: 2px 0;
  line-height: 1.6;
  align-items: baseline;
}
.ai-dc-lbl {
  font-size: 10px;
  color: #999;
  white-space: nowrap;
  min-width: 36px;
}
.ai-dc-val {
  font-size: 11px;
  color: #444;
  flex: 1;
}
.tags-inline { display: flex; gap: 3px; flex-wrap: wrap; }
.ai-dc-tag {
  font-size: 10px;
  color: #7b61ff;
  background: #eae5ff;
  padding: 0 6px;
  border-radius: 3px;
  line-height: 18px;
}
.ai-dc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

/* 生成提示词文本域 */
.ai-prompt-textarea {
  width: 100%;
  min-height: 120px;
  font-size: 12px;
  line-height: 1.7;
  color: #333;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 12px;
  resize: vertical;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ai-prompt-textarea:focus {
  border-color: #7b61ff;
  box-shadow: 0 0 0 2px rgba(123,97,255,0.15);
}
.ai-prompt-textarea::placeholder { color: #ccc; }

/* 建议列表 */
.ai-sug-list { margin: 0; padding: 0 0 0 16px; }
.ai-sug-item { font-size: 11px; color: #d85a30; line-height: 1.7; padding: 1px 0; }
.ai-tag {
  font-size: 10px;
  color: #7b61ff;
  background: #f0edff;
  padding: 2px 7px;
  border-radius: 4px;
}
</style>
