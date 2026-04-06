import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, PendingRequest } from './types.js';

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private extensionWs: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestTimeout: number;

  // 心跳相关
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPongTime = 0;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60秒

  constructor(requestTimeout = 30000) {
    this.requestTimeout = requestTimeout;
  }

  // 启动 WebSocket 服务器
  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    console.log(`[WebSocket] 服务器启动在端口 ${port}`);

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`[WebSocket] 客户端连接: ${clientIp}`);

      // 目前只支持一个扩展连接
      if (this.extensionWs) {
        console.log('[WebSocket] 已有扩展连接，关闭旧连接');
        this.extensionWs.close();
      }

      this.extensionWs = ws;

      // 启动心跳
      this.startHeartbeat();

      ws.on('message', (data) => {
        this.handleMessage(data);
      });

      ws.on('close', () => {
        console.log('[WebSocket] 客户端断开连接');
        this.stopHeartbeat();
        if (this.extensionWs === ws) {
          this.extensionWs = null;
        }
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] 连接错误:', error);
      });

      // 发送欢迎消息
      this.sendToExtension({
        id: `welcome-${Date.now()}`,
        type: 'WELCOME',
        payload: { message: 'Connected to Agent Browser Operator Server' },
      });
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] 服务器错误:', error);
    });
  }

  // 停止 WebSocket 服务器
  stop(): void {
    this.stopHeartbeat();

    // 清理所有待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server is shutting down'));
    }
    this.pendingRequests.clear();

    if (this.extensionWs) {
      this.extensionWs.close();
      this.extensionWs = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  // 启动心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    // 定期发送 ping
    this.heartbeatInterval = setInterval(() => {
      if (this.extensionWs?.readyState === WebSocket.OPEN) {
        this.sendToExtension({
          id: `ping-${Date.now()}`,
          type: 'PING',
          payload: { timestamp: Date.now() },
        });

        // 设置超时检测
        if (this.heartbeatTimeout) {
          clearTimeout(this.heartbeatTimeout);
        }
        this.heartbeatTimeout = setTimeout(() => {
          const timeSinceLastPong = Date.now() - this.lastPongTime;
          if (timeSinceLastPong > this.HEARTBEAT_TIMEOUT) {
            console.log('[WebSocket] 心跳超时，关闭连接');
            this.extensionWs?.close();
          }
        }, this.HEARTBEAT_TIMEOUT);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // 检查扩展是否已连接
  isExtensionConnected(): boolean {
    return this.extensionWs !== null && this.extensionWs.readyState === WebSocket.OPEN;
  }

  // 发送消息到扩展并等待响应
  async sendAndWait(message: WSMessage): Promise<unknown> {
    if (!this.isExtensionConnected()) {
      throw new Error('Extension not connected');
    }

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      // 存储待处理的请求
      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout,
      });

      // 发送消息
      this.sendToExtension(message);
    });
  }

  // 发送消息到扩展（不等待响应）
  sendToExtension(message: WSMessage): void {
    if (this.extensionWs && this.extensionWs.readyState === WebSocket.OPEN) {
      this.extensionWs.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] 扩展未连接，无法发送消息');
    }
  }

  // 处理收到的消息
  private handleMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      console.log('[WebSocket] 收到消息:', message.type, message.id);

      // 处理心跳响应
      if (message.type === 'PONG') {
        this.lastPongTime = Date.now();
        return;
      }

      // 处理客户端发来的 ping
      if (message.type === 'PING') {
        this.sendToExtension({
          id: `pong-${Date.now()}`,
          type: 'PONG',
          payload: { timestamp: Date.now() },
        });
        return;
      }

      // 检查是否是响应消息
      if (message.id && this.pendingRequests.has(message.id)) {
        const pending = this.pendingRequests.get(message.id)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.payload);
        }
      } else {
        // 处理主动推送的消息
        this.handlePushMessage(message);
      }
    } catch (error) {
      console.error('[WebSocket] 消息处理失败:', error);
    }
  }

  // 处理扩展主动推送的消息
  private handlePushMessage(message: WSMessage): void {
    console.log('[WebSocket] 推送消息:', message.type, message.payload);
    // 这里可以添加广播到 HTTP 客户端或其他逻辑
  }
}
