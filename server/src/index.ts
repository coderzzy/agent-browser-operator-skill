import { WebSocketManager } from './websocket-server.js';
import { HttpServer } from './http-server.js';
import { createServer } from 'http';

// 固定端口配置
const HTTP_PORT = 3333;
const WS_PORT = 3334;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     Agent Browser Operator Server                       ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

// 创建 WebSocket 管理器
const wsManager = new WebSocketManager(REQUEST_TIMEOUT);

// 创建 HTTP 服务器
const httpServer = new HttpServer(wsManager, HTTP_PORT);

// 检查端口是否被占用
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// 启动服务
async function startServer() {
  // 检查 HTTP 端口
  const httpPortAvailable = await checkPort(HTTP_PORT);
  if (!httpPortAvailable) {
    console.error(`❌ 错误：HTTP 端口 ${HTTP_PORT} 已被占用！`);
    console.error('   请关闭占用该端口的服务后重试。');
    process.exit(1);
  }

  // 检查 WebSocket 端口
  const wsPortAvailable = await checkPort(WS_PORT);
  if (!wsPortAvailable) {
    console.error(`❌ 错误：WebSocket 端口 ${WS_PORT} 已被占用！`);
    console.error('   请关闭占用该端口的服务后重试。');
    process.exit(1);
  }

  // 启动服务
  try {
    wsManager.start(WS_PORT);
    httpServer.start();

    console.log();
    console.log('─────────────────────────────────────────────────────────');
    console.log('✅ 服务启动成功！');
    console.log(`   HTTP API: http://localhost:${HTTP_PORT}`);
    console.log(`   WebSocket: ws://localhost:${WS_PORT}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log();
  } catch (error) {
    console.error('❌ 服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[Server] 正在关闭服务...');
  wsManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] 正在关闭服务...');
  wsManager.stop();
  process.exit(0);
});
