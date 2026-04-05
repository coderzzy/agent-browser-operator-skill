import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import type { WebSocketManager } from './websocket-server.js';
import type { WSMessage, TabInfo, OpenTabRequest, ApiResponse } from './types.js';

// 生成唯一消息 ID
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class HttpServer {
  private app: express.Application;
  private wsManager: WebSocketManager;
  private port: number;

  constructor(wsManager: WebSocketManager, port = 3000) {
    this.app = express();
    this.wsManager = wsManager;
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    const router = Router();

    // 健康检查 - 服务状态
    router.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // 完整状态检查 - 包含 WebSocket 连接状态
    router.get('/check', (_req: Request, res: Response) => {
      const extensionConnected = this.wsManager.isExtensionConnected();
      res.json({
        status: 'ok',
        service: 'running',
        extensionConnected,
        websocket: {
          url: 'ws://localhost:3334',
          connected: extensionConnected,
        },
        http: {
          url: 'http://localhost:3333',
          status: 'running',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // 获取所有标签页
    router.get('/api/tabs', async (_req: Request, res: Response<ApiResponse<{ tabs: TabInfo[] }>>) => {
      try {
        const response = await this.sendToExtension('GET_TABS');
        res.json({
          success: true,
          data: response as { tabs: TabInfo[] },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 获取当前活动标签页
    router.get('/api/tabs/active', async (_req: Request, res: Response<ApiResponse<{ tab: TabInfo | null }>>) => {
      try {
        const response = await this.sendToExtension('GET_ACTIVE_TAB');
        res.json({
          success: true,
          data: response as { tab: TabInfo | null },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 打开新标签页
    router.post('/api/tabs/open', async (req: Request<unknown, unknown, OpenTabRequest>, res: Response<ApiResponse<{ tab: TabInfo }>>) => {
      try {
        const { url, active } = req.body;
        if (!url) {
          res.status(400).json({
            success: false,
            error: 'URL is required',
          });
          return;
        }

        const response = await this.sendToExtension('OPEN_TAB', { url, active });
        res.json({
          success: true,
          data: response as { tab: TabInfo },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 关闭标签页
    router.post('/api/tabs/close', async (req: Request<unknown, unknown, { tabId: number }>, res: Response<ApiResponse<{ success: boolean }>>) => {
      try {
        const { tabId } = req.body;
        if (typeof tabId !== 'number') {
          res.status(400).json({
            success: false,
            error: 'tabId is required',
          });
          return;
        }

        await this.sendToExtension('CLOSE_TAB', { tabId });
        res.json({
          success: true,
          data: { success: true },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 激活标签页
    router.post('/api/tabs/activate', async (req: Request<unknown, unknown, { tabId: number }>, res: Response<ApiResponse<{ success: boolean }>>) => {
      try {
        const { tabId } = req.body;
        if (typeof tabId !== 'number') {
          res.status(400).json({
            success: false,
            error: 'tabId is required',
          });
          return;
        }

        await this.sendToExtension('ACTIVATE_TAB', { tabId });
        res.json({
          success: true,
          data: { success: true },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 刷新标签页
    router.post('/api/tabs/reload', async (req: Request<unknown, unknown, { tabId: number }>, res: Response<ApiResponse<{ success: boolean }>>) => {
      try {
        const { tabId } = req.body;
        if (typeof tabId !== 'number') {
          res.status(400).json({
            success: false,
            error: 'tabId is required',
          });
          return;
        }

        await this.sendToExtension('RELOAD_TAB', { tabId });
        res.json({
          success: true,
          data: { success: true },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 执行脚本
    router.post('/api/tabs/execute-script', async (req: Request<unknown, unknown, { tabId: number; script: string }>, res: Response<ApiResponse<{ result: unknown }>>) => {
      try {
        const { tabId, script } = req.body;
        if (typeof tabId !== 'number' || !script) {
          res.status(400).json({
            success: false,
            error: 'tabId and script are required',
          });
          return;
        }

        const response = await this.sendToExtension('EXECUTE_SCRIPT', { tabId, script });
        res.json({
          success: true,
          data: response as { result: unknown },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    // 获取页面内容
    router.get('/api/tabs/:tabId/content', async (req: Request<{ tabId: string }>, res: Response<ApiResponse<{ content: string }>>) => {
      try {
        const tabId = parseInt(req.params.tabId, 10);
        if (isNaN(tabId)) {
          res.status(400).json({
            success: false,
            error: 'Invalid tabId',
          });
          return;
        }

        const response = await this.sendToExtension('GET_TAB_CONTENT', { tabId });
        res.json({
          success: true,
          data: response as { content: string },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: String(error),
        });
      }
    });

    this.app.use(router);
  }

  // 发送消息到扩展
  private async sendToExtension(type: string, payload?: unknown): Promise<unknown> {
    const message: WSMessage = {
      id: generateMessageId(),
      type,
      payload,
    };

    return this.wsManager.sendAndWait(message);
  }

  // 启动 HTTP 服务器
  start(): void {
    this.app.listen(this.port, () => {
      console.log(`[HTTP] 服务器启动在端口 ${this.port}`);
      console.log(`[HTTP] API 文档: http://localhost:${this.port}/health`);
    });
  }
}
