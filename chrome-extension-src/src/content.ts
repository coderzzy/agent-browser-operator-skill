// Content Script - 注入到每个页面中
// 用于与页面 DOM 交互

console.log('[Content] 脚本已加载');

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[Content] 收到消息:', request);

  if (request.type === 'PING') {
    sendResponse({ pong: true });
    return true;
  }

  // 获取页面文本内容
  if (request.type === 'GET_PAGE_TEXT') {
    const text = document.body.innerText;
    sendResponse({ text });
    return true;
  }

  // 获取页面标题
  if (request.type === 'GET_PAGE_TITLE') {
    sendResponse({ title: document.title });
    return true;
  }

  // 获取页面 URL
  if (request.type === 'GET_PAGE_URL') {
    sendResponse({ url: window.location.href });
    return true;
  }

  // 滚动到指定位置
  if (request.type === 'SCROLL_TO') {
    const { x, y } = request.payload || {};
    window.scrollTo(x || 0, y || 0);
    sendResponse({ success: true });
    return true;
  }

  // 点击元素
  if (request.type === 'CLICK_ELEMENT') {
    const { selector } = request.payload || {};
    const element = document.querySelector(selector);
    if (element) {
      (element as HTMLElement).click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Element not found' });
    }
    return true;
  }

  // 填充输入框
  if (request.type === 'FILL_INPUT') {
    const { selector, value } = request.payload || {};
    const element = document.querySelector(selector) as HTMLInputElement;
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Element not found' });
    }
    return true;
  }

  return false;
});
