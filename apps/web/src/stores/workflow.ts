import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<any[]>([])
  const currentWorkflow = ref<any>(null)
  const loading = ref(false)

  function setWorkflows(list: any[]) {
    workflows.value = list
  }

  function setCurrent(wf: any) {
    currentWorkflow.value = wf
  }

  return { workflows, currentWorkflow, loading, setWorkflows, setCurrent }
})
