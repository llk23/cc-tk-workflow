<template>
  <div class="workflow-editor">
    <h2>工作流编辑器</h2>
    <div class="editor-layout">
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
      <div class="canvas-area" ref="canvasArea">
        <div class="placeholder">
          <p>从左侧拖拽节点到此处开始搭建工作流</p>
          <button class="btn-primary" @click="createDefaultWorkflow">快速创建默认管线</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const availableNodes = [
  { type: 'fetch-tk', label: 'TK 视频抓取', icon: '📥', description: '从 TK 抓取视频' },
  { type: 'ai-analyze', label: 'AI 视频分析', icon: '🧠', description: '多模态 AI 分析' },
  { type: 'video-generate', label: 'AI 视频生成', icon: '🎬', description: '生成新视频' },
  { type: 'transform', label: '数据转换', icon: '🔄', description: '格式转换/过滤' },
  { type: 'condition', label: '条件判断', icon: '🔀', description: '条件分支路由' },
  { type: 'output', label: '结果输出', icon: '📤', description: '保存/通知' },
]

const canvasArea = ref<HTMLElement | null>(null)

function onDragStart(event: DragEvent, node: any) {
  event.dataTransfer?.setData('application/json', JSON.stringify(node))
}

function createDefaultWorkflow() {
  alert('将在画布上创建默认的 抓取→分析→生成 管线')
}
</script>

<style scoped>
.workflow-editor h2 { margin-bottom: 20px; color: #1a1a2e; }
.editor-layout { display: flex; gap: 16px; height: calc(100vh - 120px); }
.node-palette {
  width: 240px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}
.node-palette h4 { margin-bottom: 12px; color: #555; font-size: 13px; }
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
.palette-item:hover { border-color: #4a90d9; background: #f0f6ff; }
.node-icon { font-size: 20px; }
.palette-item strong { font-size: 13px; }
.palette-item p { font-size: 11px; color: #999; margin-top: 2px; }
.canvas-area {
  flex: 1;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder { text-align: center; color: #aaa; }
.placeholder p { margin-bottom: 16px; }
.btn-primary {
  padding: 10px 20px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary:hover { background: #357abd; }
</style>
