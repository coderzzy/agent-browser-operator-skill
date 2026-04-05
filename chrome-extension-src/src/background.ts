import { getWebSocketClient } from './websocket';
import {
  getAllTabs,
  getActiveTab,
  openTab,
  closeTab,
  activateTab,
  reloadTab,
  executeScript,
  getTabContent,
} from './tabs';
import { CONFIG } from './config';
// import type { WSMessage } from './types';

// 生成唯一消息 ID
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 初始化 WebSocket 客户端
const wsClient = getWebSocketClient({
  serverUrl: CONFIG.WS_SERVER_URL,
  reconnectInterval: CONFIG.WS_RECONNECT_INTERVAL,
  maxReconnectAttempts: CONFIG.WS_MAX_RECONNECT_ATTEMPTS,
});

// 处理来自服务器的消息
function setupMessageHandlers(): void {
  // 获取所有标签页
  wsClient.onMessage('GET_TABS', async (message) => {
    try {
      const tabs = await getAllTabs();
      wsClient.send({
        id: message.id,
        type: 'GET_TABS_RESPONSE',
        payload: { tabs },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'GET_TABS_RESPONSE',
        error: String(error),
      });
    }
  });

  // 获取活动标签页
  wsClient.onMessage('GET_ACTIVE_TAB', async (message) => {
    try {
      const tab = await getActiveTab();
      wsClient.send({
        id: message.id,
        type: 'GET_ACTIVE_TAB_RESPONSE',
        payload: { tab },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'GET_ACTIVE_TAB_RESPONSE',
        error: String(error),
      });
    }
  });

  // 打开新标签页
  wsClient.onMessage('OPEN_TAB', async (message) => {
    try {
      const { url, active } = (message.payload as { url: string; active?: boolean }) || {};
      if (!url) {
        throw new Error('URL is required');
      }
      const tab = await openTab({ url, active });
      wsClient.send({
        id: message.id,
        type: 'OPEN_TAB_RESPONSE',
        payload: { tab },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'OPEN_TAB_RESPONSE',
        error: String(error),
      });
    }
  });

  // 关闭标签页
  wsClient.onMessage('CLOSE_TAB', async (message) => {
    try {
      const { tabId } = (message.payload as { tabId: number }) || {};
      if (typeof tabId !== 'number') {
        throw new Error('tabId is required');
      }
      await closeTab(tabId);
      wsClient.send({
        id: message.id,
        type: 'CLOSE_TAB_RESPONSE',
        payload: { success: true },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'CLOSE_TAB_RESPONSE',
        error: String(error),
      });
    }
  });

  // 激活标签页
  wsClient.onMessage('ACTIVATE_TAB', async (message) => {
    try {
      const { tabId } = (message.payload as { tabId: number }) || {};
      if (typeof tabId !== 'number') {
        throw new Error('tabId is required');
      }
      await activateTab(tabId);
      wsClient.send({
        id: message.id,
        type: 'ACTIVATE_TAB_RESPONSE',
        payload: { success: true },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'ACTIVATE_TAB_RESPONSE',
        error: String(error),
      });
    }
  });

  // 刷新标签页
  wsClient.onMessage('RELOAD_TAB', async (message) => {
    try {
      const { tabId } = (message.payload as { tabId: number }) || {};
      if (typeof tabId !== 'number') {
        throw new Error('tabId is required');
      }
      await reloadTab(tabId);
      wsClient.send({
        id: message.id,
        type: 'RELOAD_TAB_RESPONSE',
        payload: { success: true },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'RELOAD_TAB_RESPONSE',
        error: String(error),
      });
    }
  });

  // 执行脚本
  wsClient.onMessage('EXECUTE_SCRIPT', async (message) => {
    try {
      const { tabId, script } = (message.payload as { tabId: number; script: string }) || {};
      if (typeof tabId !== 'number' || !script) {
        throw new Error('tabId and script are required');
      }
      const result = await executeScript(tabId, script);
      wsClient.send({
        id: message.id,
        type: 'EXECUTE_SCRIPT_RESPONSE',
        payload: { result },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'EXECUTE_SCRIPT_RESPONSE',
        error: String(error),
      });
    }
  });

  // 获取页面内容
  wsClient.onMessage('GET_TAB_CONTENT', async (message) => {
    try {
      const { tabId } = (message.payload as { tabId: number }) || {};
      if (typeof tabId !== 'number') {
        throw new Error('tabId is required');
      }
      const content = await getTabContent(tabId);
      wsClient.send({
        id: message.id,
        type: 'GET_TAB_CONTENT_RESPONSE',
        payload: { content },
      });
    } catch (error) {
      wsClient.send({
        id: message.id,
        type: 'GET_TAB_CONTENT_RESPONSE',
        error: String(error),
      });
    }
  });
}

// 监听扩展安装/更新事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] 扩展已安装/更新:', details.reason);

  // 初始化存储
  chrome.storage.local.set({
    serverUrl: CONFIG.WS_SERVER_URL,
    isConnected: false,
  });

  // 设置消息处理器并连接 WebSocket
  setupMessageHandlers();
  wsClient.connect();
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] 收到消息:', message);

  if (message.type === 'GET_CONNECTION_STATUS') {
    sendResponse({ connected: wsClient.isConnected() });
    return true;
  }

  if (message.type === 'CONNECT_WEBSOCKET') {
    wsClient.connect();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'DISCONNECT_WEBSOCKET') {
    wsClient.disconnect();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'UPDATE_SERVER_URL') {
    const { serverUrl } = message.payload || {};
    if (serverUrl) {
      chrome.storage.local.set({ serverUrl });
      // 重新连接
      wsClient.disconnect();
      // 创建新的客户端实例
      const newClient = getWebSocketClient({ serverUrl });
      setupMessageHandlers();
      newClient.connect();
    }
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// 监听标签页变化事件并通知服务器
chrome.tabs.onCreated.addListener((tab) => {
  if (wsClient.isConnected()) {
    wsClient.send({
      id: generateMessageId(),
      type: 'TAB_CREATED',
      payload: { tab },
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (wsClient.isConnected()) {
    wsClient.send({
      id: generateMessageId(),
      type: 'TAB_REMOVED',
      payload: { tabId },
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (wsClient.isConnected()) {
    wsClient.send({
      id: generateMessageId(),
      type: 'TAB_ACTIVATED',
      payload: activeInfo,
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (wsClient.isConnected()) {
    wsClient.send({
      id: generateMessageId(),
      type: 'TAB_UPDATED',
      payload: { tabId, changeInfo, tab },
    });
  }
});

// 初始连接
setupMessageHandlers();
wsClient.connect();
