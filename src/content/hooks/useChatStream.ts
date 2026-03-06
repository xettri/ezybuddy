import { useState, useEffect } from 'react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export type ChatEntry = { role: 'user' | 'assistant'; text: string };

function cleanMarkdown(raw: string): string {
  let md = raw.replace(/^```[\w]*\n([\s\S]*?)```$/m, '$1').trim();
  md = md.replace(/^(\s*[-*+])\s+\[[ xX]?\]\s*/gm, '$1 ');
  const seen = new Set<string>();
  md = md
    .split('\n')
    .filter((line) => {
      const isBullet = /^\s*[-*+]\s/.test(line);
      if (!isBullet) return true;
      const key = line.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
  return md;
}

export function useChatStream(historyKey: string) {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatusText, setModelStatusText] = useState('');

  const [chatHistory, setChatHistory] = useState<ChatEntry[]>(() => {
    try {
      const raw = sessionStorage.getItem(historyKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [activeRequest, setActiveRequest] = useState<{
    id: string;
    userText: string;
    rawText: string;
    htmlResult: string;
    error: string | null;
  } | null>(null);

  const saveHistory = (entries: ChatEntry[]) => {
    const capped = entries.slice(-10); // MAX_EXCHANGES=5 * 2
    setChatHistory(capped);
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(capped));
    } catch { }
  };

  const clearHistory = () => {
    setChatHistory([]);
    try {
      sessionStorage.removeItem(historyKey);
    } catch { }
  };

  useEffect(() => {
    const listener = (msg: any) => {
      if (!msg?.type) return;

      if (msg.type === 'OFFSCREEN_AI_LOAD_PROGRESS') {
        const pct = Math.round((msg.payload?.progress ?? 0) * 100);
        const isCached = msg.payload?.isCached === true;
        const displayTxt =
          modelLoaded || isCached ? 'Waking up AI engine…' : 'Loading AI model (first time only)';

        setModelProgress(pct);
        setModelStatusText(pct < 100 ? displayTxt : 'Almost ready…');
        if (pct >= 100) setModelLoaded(true);
      }

      if (msg.type === 'OFFSCREEN_AI_STREAM_CHUNK') {
        setModelLoaded(true);
        const { requestId, text } = msg.payload ?? {};
        setActiveRequest((req) => {
          if (!req || req.id !== requestId) return req;
          const newRaw = req.rawText + text;
          return {
            ...req,
            rawText: newRaw,
            htmlResult: marked.parse(cleanMarkdown(newRaw)) as string,
          };
        });
      }

      if (msg.type === 'OFFSCREEN_AI_STREAM_DONE' || msg.type === 'OFFSCREEN_AI_STREAM_ERROR') {
        const requestId = msg.payload?.requestId;

        setActiveRequest((req) => {
          if (!req || req.id !== requestId) return req;

          if (msg.type === 'OFFSCREEN_AI_STREAM_ERROR') {
            return { ...req, error: msg.payload?.error ?? 'Error' };
          }

          // Stream Done - promote request to history
          if (req.rawText) {
            const newHistory = [
              ...chatHistory,
              { role: 'user' as const, text: req.userText },
              { role: 'assistant' as const, text: cleanMarkdown(req.rawText) },
            ];
            saveHistory(newHistory);
          }
          return null; // clear active request
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [modelLoaded, chatHistory, historyKey]);

  return {
    modelLoaded,
    modelProgress,
    modelStatusText,
    chatHistory,
    activeRequest,
    setActiveRequest,
    clearHistory,
  };
}
