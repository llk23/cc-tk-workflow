import { defineStore } from 'pinia'
import { ref } from 'vue'

// 画布图的 nodes/edges 由 Vue Flow 的 useVueFlow() 管理（见 WorkflowEditor.vue）。
// 这里只放"非图"的 UI 状态：名称、当前工作流 id、选中节点、执行日志。
export const useWorkflowStore = defineStore('workflow', () => {
  const workflowName = ref('未命名工作流')
  const currentWorkflowId = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const logs = ref<string[]>([])
  const running = ref(false)

  function addLog(msg: string) {
    logs.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
  }
  function clearLogs() {
    logs.value = []
  }

  function setSelected(id: string | null) {
    selectedNodeId.value = id
  }

  return {
    workflowName,
    currentWorkflowId,
    selectedNodeId,
    logs,
    running,
    addLog,
    clearLogs,
    setSelected,
  }
})
