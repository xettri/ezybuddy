// Send SHOW_CHAT to the active tab and immediately close the popup.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0]?.id;
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_CHAT' }).catch(() => {});
  }
  window.close();
});
