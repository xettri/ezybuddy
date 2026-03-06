import { createRoot } from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import App from './components/App';

const EB_ROOT_ID = 'ezybuddy-root';
const EB_CACHE_KEY = 'eb-xettri';

function getHost() {
  const hostNode = document.createElement('div');
  hostNode.id = EB_ROOT_ID;
  document.documentElement.appendChild(hostNode);
  return hostNode;
}

function getShadowRoot() {
  const hostNode = getHost();
  const shadowRoot = hostNode.attachShadow({ mode: 'open' });
  return shadowRoot;
}


export function render() {
  if (document.getElementById(EB_ROOT_ID)) return;
  const shadowRoot = getShadowRoot();

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

export default render;
