import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable } from '@nestjs/common'

/**
 * 执行进度 WebSocket 网关。
 *
 * 【wb添加 / 模拟说明】当前 startSimulatedProgress 是按节点顺序"假装"跑一遍并发进度，
 * 因为真实执行依赖 Phase 3 的异步 worker（BullMQ Consumer）。等 Phase 3 落地后，
 * 把这里的模拟循环替换成：worker 每完成一个节点就 emit 一次真实进度即可。
 */
@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class WorkflowGateway {
  @WebSocketServer() server!: Server

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { executionId: string }) {
    client.join(payload.executionId)
  }

  /**
   * 【wb添加 / Phase 3】真实进度推送入口。
   * 由 BullMQ Worker 在节点执行过程中调用，向前端推送真实进度。
   */
  pushProgress(executionId: string, type: string, nodeId?: string, message?: string) {
    this.server.to(executionId).emit('progress', { type, nodeId, message })
  }

  /** 兼容旧逻辑：模拟进度（Phase 3 落地后已不再由 controller 调用，保留作回退） */
  async startSimulatedProgress(executionId: string, workflow: { nodes?: any[] }) {
    const emit = (type: string, nodeId?: string, message?: string) =>
      this.server.to(executionId).emit('progress', { type, nodeId, message })

    emit('queued', undefined, '工作流已入队')
    await this.delay(400)

    for (const node of workflow.nodes || []) {
      emit('node:start', node.id, `开始执行节点：${node.label || node.type}`)
      await this.delay(900)
      emit('node:success', node.id, `节点完成：${node.label || node.type}`)
    }
    emit('completed', undefined, '工作流执行完成（模拟进度，真实 worker 待 Phase 3）')
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
