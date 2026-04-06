import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { CONFIG } from './config';

// interface ConnectionStatus {
//   connected: boolean;
//   serverUrl: string;
// }

const Popup: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>(CONFIG.WS_SERVER_URL);
  const [inputUrl, setInputUrl] = useState<string>(CONFIG.WS_SERVER_URL);
  const [tabCount, setTabCount] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  useEffect(() => {
    // 加载存储的设置
    chrome.storage.local.get(['serverUrl', 'isConnected'], (result) => {
      if (result.serverUrl) {
        setServerUrl(result.serverUrl);
        setInputUrl(result.serverUrl);
      }
      if (result.isConnected !== undefined) {
        setConnected(result.isConnected);
      }
    });

    // 获取连接状态
    checkConnectionStatus();

    // 获取标签页数量
    updateTabCount();

    // 监听连接状态变化
    const messageListener = (message: { type: string; payload?: { connected: boolean } }) => {
      if (message.type === 'CONNECTION_STATUS' && message.payload) {
        setConnected(message.payload.connected);
        chrome.storage.local.set({ isConnected: message.payload.connected });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const checkConnectionStatus = () => {
    chrome.runtime.sendMessage(
      { type: 'GET_CONNECTION_STATUS' },
      (response: { connected: boolean }) => {
        if (response) {
          setConnected(response.connected);
        }
      }
    );
  };

  const updateTabCount = () => {
    chrome.tabs.query({}, (tabs) => {
      setTabCount(tabs.length);
    });
  };

  const handleConnect = () => {
    if (inputUrl !== serverUrl) {
      // 更新服务器地址
      chrome.runtime.sendMessage(
        {
          type: 'UPDATE_SERVER_URL',
          payload: { serverUrl: inputUrl },
        },
        (response) => {
          if (response?.success) {
            setMessage({ type: 'success', text: '服务器地址已更新，正在连接...' });
            setTimeout(() => setMessage({ type: null, text: '' }), 3000);
          } else {
            setMessage({ type: 'error', text: '更新服务器地址失败' });
            setTimeout(() => setMessage({ type: null, text: '' }), 3000);
          }
        }
      );
      setServerUrl(inputUrl);
    } else {
      // 重新连接
      chrome.runtime.sendMessage({ type: 'CONNECT_WEBSOCKET' }, (response) => {
        if (response?.success) {
          setMessage({ type: 'success', text: '连接请求已发送' });
          setTimeout(() => setMessage({ type: null, text: '' }), 3000);
        } else {
          setMessage({ type: 'error', text: '连接失败，请检查服务是否启动' });
          setTimeout(() => setMessage({ type: null, text: '' }), 3000);
        }
      });
    }
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT_WEBSOCKET' });
  };

  return (
    <div>
      <div className="header">
        <h1>🌐 Agent Browser Operator</h1>
        <p>让 AI Agent 远程控制浏览器</p>
      </div>

      <div className="content">
        <div className="status-card">
          <div className="status-header">
            <span className="status-label">连接状态</span>
            <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {connected ? '已连接' : '未连接'}
            </span>
          </div>
          <div className="server-url">{serverUrl}</div>
        </div>

        <div className="input-group">
          <label htmlFor="server-url">服务器地址</label>
          <input
            id="server-url"
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={CONFIG.WS_SERVER_URL}
            disabled={connected}
          />
        </div>

        {connected ? (
          <button className="btn btn-secondary" onClick={handleDisconnect}>
            断开连接
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleConnect}>
            连接服务器
          </button>
        )}

        {message.type && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <div className="info-section">
          <div className="info-item">
            <span className="info-label">当前标签页数</span>
            <span className="info-value">{tabCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">扩展版本</span>
            <span className="info-value">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
