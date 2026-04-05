// 统一配置文件
// 所有模块共享的配置常量

export const CONFIG = {
  // WebSocket 服务器地址
  WS_SERVER_URL: 'ws://localhost:3334',

  // HTTP API 服务器地址（供参考）
  HTTP_SERVER_URL: 'http://localhost:3333',

  // WebSocket 重连配置
  WS_RECONNECT_INTERVAL: 3000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,

  // 请求超时时间（毫秒）
  REQUEST_TIMEOUT: 30000,

  // WebSocket 心跳配置（防止连接因空闲被断开）
  HEARTBEAT_INTERVAL: 30000, // 心跳间隔：30秒
  HEARTBEAT_TIMEOUT: 60000, // 心跳超时：60秒（超过此时间未收到pong则认为连接断开）
} as const;

// 导出类型
export type Config = typeof CONFIG;
