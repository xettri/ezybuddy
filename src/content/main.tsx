import { createRoot } from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import App from './components/App';

const EB_ROOT_ID = 'ezybuddy-root';
const EB_CACHE_KEY = 'eb-xettri';

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

function injectApp() {
  if (document.getElementById(EB_ROOT_ID)) return;

  const hostNode = document.createElement('div');
  hostNode.id = EB_ROOT_ID;
  document.documentElement.appendChild(hostNode);

  const shadowRoot = hostNode.attachShadow({ mode: 'open' });

  // Create Emotion cache for Shadow DOM
  const emotionCache = createCache({
    key: EB_CACHE_KEY,
    container: shadowRoot,
  });

  // Render the React App into the shadow root
  const appContainer = document.createElement('div');
  shadowRoot.appendChild(appContainer);

  const root = createRoot(appContainer);
  root.render(
    <CacheProvider value={emotionCache}>
      <App />
    </CacheProvider>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectApp);
} else {
  injectApp();
}
