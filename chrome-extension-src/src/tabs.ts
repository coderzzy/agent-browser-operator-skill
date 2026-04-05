import type { TabInfo, OpenTabRequest } from './types';

// 将 Chrome 的 Tab 转换为我们的 TabInfo 格式
function convertTabToTabInfo(tab: chrome.tabs.Tab): TabInfo {
  return {
    id: tab.id || -1,
    title: tab.title || '',
    url: tab.url || '',
    active: tab.active || false,
    windowId: tab.windowId || -1,
    index: tab.index || 0,
    favIconUrl: tab.favIconUrl,
  };
}

// 获取所有标签页
export async function getAllTabs(): Promise<TabInfo[]> {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs.map(convertTabToTabInfo);
  } catch (error) {
    console.error('[Tabs] 获取标签页失败:', error);
    throw error;
  }
}

// 获取当前活动标签页
export async function getActiveTab(): Promise<TabInfo | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      return null;
    }
    return convertTabToTabInfo(tabs[0]);
  } catch (error) {
    console.error('[Tabs] 获取活动标签页失败:', error);
    throw error;
  }
}

// 打开新标签页
export async function openTab(request: OpenTabRequest): Promise<TabInfo> {
  try {
    const tab = await chrome.tabs.create({
      url: request.url,
      active: request.active !== false, // 默认激活
    });
    return convertTabToTabInfo(tab);
  } catch (error) {
    console.error('[Tabs] 打开标签页失败:', error);
    throw error;
  }
}

// 关闭标签页
export async function closeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    console.error('[Tabs] 关闭标签页失败:', error);
    throw error;
  }
}

// 切换标签页
export async function activateTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (error) {
    console.error('[Tabs] 切换标签页失败:', error);
    throw error;
  }
}

// 刷新标签页
export async function reloadTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.reload(tabId);
  } catch (error) {
    console.error('[Tabs] 刷新标签页失败:', error);
    throw error;
  }
}

// 在指定标签页执行脚本
export async function executeScript(
  tabId: number,
  script: string
): Promise<unknown> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (code) => {
        try {
          // eslint-disable-next-line no-eval
          return eval(code);
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [script],
    });
    return results[0]?.result;
  } catch (error) {
    console.error('[Tabs] 执行脚本失败:', error);
    throw error;
  }
}

// 获取标签页页面内容
export async function getTabContent(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return document.documentElement.outerHTML;
      },
    });
    return String(results[0]?.result || '');
  } catch (error) {
    console.error('[Tabs] 获取页面内容失败:', error);
    throw error;
  }
}
