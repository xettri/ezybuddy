import { render } from '../../app';

// Developer Utility: Listen for a custom event from the page to wipe the WebLLM cache
document.addEventListener('eb:clear-cache', () => {
  console.debug('Requesting offscreen document to clear WebLLM cache...');
  chrome.runtime.sendMessage({ type: 'DEV_CLEAR_CACHE' }, (res) => {
    if (res?.ok) {
      console.debug('Cache cleared! Reload the page to test fresh AI download.');
    } else {
      console.debug('Failed to clear cache:', res?.error);
    }
  });
});

function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true })
  } else {
    render();
  }
}

init();