import type { WSMessage, WSConfig } from './types';
import { CONFIG } from './config';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WSConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Map<string, (message: WSMessage) => void> = new Map();
  private pendingMessages: WSMessage[] = [];

  // 心跳相关
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPongTime = 0;

  constructor(config: Partial<WSConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || CONFIG.WS_SERVER_URL,
      reconnectInterval: config.reconnectInterval || CONFIG.WS_RECONNECT_INTERVAL,
      maxReconnectAttempts: config.maxReconnectAttempts || CONFIG.WS_MAX_RECONNECT_ATTEMPTS,
    };
  }

  // 连接到 WebSocket 服务器
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] 已经连接');
      return;
    }

    try {
      console.log('[WebSocket] 正在连接到:', this.config.serverUrl);
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('[WebSocket] 连接失败:', error);
      this.scheduleReconnect();
    }
  }

  // 断开连接
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // 发送消息
  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // 如果未连接，暂存消息
      this.pendingMessages.push(message);
      console.log('[WebSocket] 连接未就绪，消息已暂存');
    }
  }

  // 注册消息处理器
  onMessage(type: string, handler: (message: WSMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // 移除消息处理器
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 启动心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    // 定期发送 ping
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
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
          if (timeSinceLastPong > CONFIG.HEARTBEAT_TIMEOUT) {
            console.log('[WebSocket] 心跳超时，关闭连接');
            this.ws?.close();
          }
        }, CONFIG.HEARTBEAT_TIMEOUT);
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
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

  private handleOpen(): void {
    console.log('[WebSocket] 连接已建立');
    this.reconnectAttempts = 0;

    // 启动心跳
    this.startHeartbeat();

    // 发送暂存的消息
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.send(message);
      }
    }

    // 通知 background 连接状态变化
    chrome.runtime.sendMessage({
      type: 'CONNECTION_STATUS',
      payload: { connected: true },
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      console.log('[WebSocket] 收到消息:', message);

      // 处理心跳响应
      if (message.type === 'PONG') {
        this.lastPongTime = Date.now();
        return;
      }

      // 处理服务器发来的 ping
      if (message.type === 'PING') {
        this.send({
          id: `pong-${Date.now()}`,
          type: 'PONG',
          payload: { timestamp: Date.now() },
        });
        return;
      }

      // 查找并执行对应的处理器
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      } else {
        console.log('[WebSocket] 未找到消息处理器:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket] 消息解析失败:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('[WebSocket] 连接已关闭:', event.code, event.reason);
    this.stopHeartbeat();
    this.ws = null;

    // 通知 background 连接状态变化
    chrome.runtime.sendMessage({
      type: 'CONNECTION_STATUS',
      payload: { connected: false },
    });

    // 尝试重新连接
    this.scheduleReconnect();
  }

  private handleError(error: Event): void {
    console.error('[WebSocket] 连接错误:', error);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[WebSocket] 达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[WebSocket] ${this.config.reconnectInterval}ms 后尝试第 ${this.reconnectAttempts} 次重连`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }
}

// 创建单例实例
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(config?: Partial<WSConfig>): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient(config);
  }
  return wsClient;
}
