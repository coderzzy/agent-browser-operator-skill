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

// HTTP API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 待处理的请求
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// 服务器配置
export interface ServerConfig {
  httpPort: number;
  wsPort: number;
  requestTimeout: number;
}
