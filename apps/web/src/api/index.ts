import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

export const workflowApi = {
  list: () => api.get('/workflows'),
  get: (id: string) => api.get(`/workflows/${id}`),
  create: (data: any) => api.post('/workflows', data),
  update: (id: string, data: any) => api.put(`/workflows/${id}`, data),
  remove: (id: string) => api.delete(`/workflows/${id}`),
  execute: (id: string) => api.post(`/workflows/${id}/execute`),
  debug: (id: string, nodeId: string) => api.post(`/workflows/${id}/debug`, { nodeId }),
  history: (id: string) => api.get(`/workflows/${id}/history`),
}

export const taskApi = {
  list: () => api.get('/tasks'),
  get: (id: string) => api.get(`/tasks/${id}`),
}

export const videoApi = {
  list: () => api.get('/videos'),
  get: (id: string) => api.get(`/videos/${id}`),
}

export default api
