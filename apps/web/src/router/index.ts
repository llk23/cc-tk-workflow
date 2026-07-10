import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import WorkflowEditor from '@/views/WorkflowEditor.vue'
import TaskList from '@/views/TaskList.vue'
import Settings from '@/views/Settings.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/workflow', name: 'workflow', component: WorkflowEditor },
    { path: '/tasks', name: 'tasks', component: TaskList },
    { path: '/settings', name: 'settings', component: Settings },
  ],
})
