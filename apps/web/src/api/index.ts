import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export const workflowApi = {
  list: () => api.get('/workflows'),
  get: (id: string) => api.get(`/workflows/${id}`),
  create: (data: any) => api.post('/workflows', data),
  execute: (id: string) => api.post(`/workflows/${id}/execute`),
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
