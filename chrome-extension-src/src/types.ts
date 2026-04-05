// WebSocket 消息类型
export interface WSMessage {
  id: string;
  type: string;
  payload?: unknown;
  error?: string;
}

// 标签页信息
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  active: boolean;
  windowId: number;
  index: number;
  favIconUrl?: string;
}

// 打开新标签页请求
export interface OpenTabRequest {
  url: string;
  active?: boolean;
}

// WebSocket 连接配置
export interface WSConfig {
  serverUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

// 扩展存储的数据结构
export interface ExtensionStorage {
  serverUrl: string;
  isConnected: boolean;
}
