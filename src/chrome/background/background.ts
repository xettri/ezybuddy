import { getBackend } from '../../ai/backend';
import { offscreenManager } from '../../services/offscreen';

chrome.runtime.onInstalled.addListener(() => {
  // service worker installed — no action needed
});

// When user clicks the extension icon in the toolbar, restore the hidden FAB
// and open the chat panel on the active tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || tab.id < 0) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_CHAT' });
  } catch {
    // Content script not yet injected or tab is restricted (chrome://, etc.) — ignore
  }
});

/**
 * Validate that a message sender is our own content script on a real tab.
 * Rejects messages from web pages (no extension URL), other extensions, or
 * devtools panels.
 */
function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  // Must come from a real tab
  if (!sender.tab?.id || sender.tab.id < 0) return false;
  // Must not come from another extension
  if (sender.id && sender.id !== chrome.runtime.id) return false;
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;

  // Relay streaming events from offscreen document to the requesting tab
  // Offscreen messages have no tab in sender; validate the target tabId is a number.
  if (message.type.startsWith('OFFSCREEN_AI_')) {
    if (message.type === 'OFFSCREEN_AI_LOAD_PROGRESS') {
      // Model loading is global; broadcast to all tabs so any open chat UI updates
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id && tab.id > 0) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
          }
        }
      });
      return false;
    }

    const tabId = message.payload?.tabId;
    if (typeof tabId === 'number' && tabId > 0) {
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }
    return false;
  }

  // PING — used to verify background is alive
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }

  // ABORT — halt ongoing generations
  if (message.type === 'ABORT_AI_REQUEST') {
    if (!isTrustedSender(sender)) return;
    chrome.runtime.sendMessage({ type: 'ABORT_OFFSCREEN_AI_REQUEST' });
    return;
  }

  // Developer utility to clear cache
  if (message.type === 'DEV_CLEAR_CACHE') {
    if (!isTrustedSender(sender)) return;
    // We must ensure the offscreen document is actually running before sending the message
    offscreenManager
      .ensure()
      .then(() => {
        chrome.runtime.sendMessage({ type: 'DEV_CLEAR_CACHE' }, (res) => {
          sendResponse(res);
        });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: 'Failed to spawn offscreen document: ' + err });
      });
    return true; // async
  }

  // AI_REQUEST — must come from a trusted content script
  if (message.type === 'AI_REQUEST') {
    if (!isTrustedSender(sender)) {
      sendResponse({ ok: false, error: 'Unauthorized sender' });
      return;
    }

    const payload = message.payload;
    const mode = payload?.mode;
    const query = payload?.query;
    const tabId = sender.tab!.id!;

    if (
      mode === 'pageQA' &&
      typeof query === 'string' &&
      query.length > 0 &&
      query.length <= 2000
    ) {
      const backend = getBackend();
      backend
        .pageQA({
          query,
          pageContext: payload.pageContext,
          tabId,
          requestId: typeof payload.requestId === 'string' ? payload.requestId : String(Date.now()),
        })
        .then(() => {
          sendResponse({ ok: true, message: 'Stream started' });
        })
        .catch(() => {
          sendResponse({ ok: false, error: 'AI backend error' });
        });
      return true; // async
    }

    sendResponse({ ok: false, error: 'Invalid request' });
    return;
  }
});
