import { io, type Socket } from 'socket.io-client'

// 后端 WebSocket 地址（NestJS socket.io gateway，默认端口 3000）
const WS_URL = (import.meta.env.VITE_WS_URL as string) || 'http://localhost:3000'

let socket: Socket | null = null

export interface ExecutionEvent {
  type: 'queued' | 'node:start' | 'node:success' | 'node:failed' | 'completed' | 'failed'
  nodeId?: string
  message?: string
}

export function useExecutionSocket() {
  function connect(executionId: string, onEvent: (evt: ExecutionEvent) => void) {
    // 每次运行新建一个 socket，避免上一次 run 的 listener 残留
    if (socket) {
      socket.disconnect()
      socket = null
    }
    socket = io(WS_URL, { transports: ['websocket'], forceNew: true })

    socket.on('connect', () => {
      socket!.emit('join', { executionId })
    })

    socket.on('progress', (evt: ExecutionEvent) => {
      onEvent(evt)
      if (evt.type === 'completed' || evt.type === 'failed') {
        socket?.disconnect()
        socket = null
      }
    })
  }

  return { connect }
}
