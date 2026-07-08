<template>
  <div class="settings">
    <h2>系统设置</h2>

    <section class="setting-section">
      <h3>AI 模型配置</h3>
      <div class="setting-item">
        <label>OpenAI API Key</label>
        <input type="password" v-model="openaiKey" placeholder="sk-..." />
      </div>
      <div class="setting-item">
        <label>Claude API Key</label>
        <input type="password" v-model="claudeKey" placeholder="sk-ant-..." />
      </div>
    </section>

    <section class="setting-section">
      <h3>TK 数据源</h3>
      <div class="setting-item">
        <label>API Key</label>
        <input type="password" v-model="tkApiKey" placeholder="TikAPI Key" />
      </div>
    </section>

    <button class="btn-save">保存设置</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const openaiKey = ref('')
const claudeKey = ref('')
const tkApiKey = ref('')
</script>

<style scoped>
.settings h2 { margin-bottom: 20px; color: #1a1a2e; }
.setting-section {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}
.setting-section h3 { font-size: 15px; margin-bottom: 16px; color: #333; }
.setting-item { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.setting-item label { width: 140px; font-size: 13px; color: #666; }
.setting-item input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.btn-save {
  padding: 10px 24px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
