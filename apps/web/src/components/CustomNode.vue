<template>
  <div class="wf-node" :class="`status-${data.status || 'idle'}`">
    <Handle type="target" :position="Position.Left" />
    <div class="wf-node-header">
      <span class="wf-icon">{{ icon }}</span>
      <span class="wf-label">{{ data.label }}</span>
    </div>
    <div class="wf-node-type">{{ data.nodeType }}</div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{ data: any; id: string }>()

const iconMap: Record<string, string> = {
  'fetch-tk': '📥',
  'ai-analyze': '🧠',
  'video-generate': '🎬',
  transform: '🔄',
  condition: '🔀',
  output: '📤',
}
const icon = iconMap[props.data.nodeType] || '⚙️'
</script>

<style scoped>
.wf-node {
  border: 2px solid #d0d0d0;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  min-width: 160px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.wf-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wf-icon {
  font-size: 18px;
}
.wf-label {
  font-weight: 600;
  color: #1a1a2e;
}
.wf-node-type {
  margin-top: 4px;
  font-size: 10px;
  color: #999;
  font-family: monospace;
}
/* 执行状态高亮 */
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
</style>
