import { CreateMLCEngine, MLCEngine, ChatCompletionMessageParam } from "@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
let engine: MLCEngine | null = null;
let engineInitPromise: Promise<MLCEngine> | null = null;

async function getEngine(): Promise<MLCEngine> {
  if (engine) return engine;
  if (engineInitPromise) return engineInitPromise;

  engineInitPromise = CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (progress) => {
      chrome.runtime.sendMessage({
        type: "OFFSCREEN_AI_LOAD_PROGRESS",
        payload: { progress: progress.progress, text: progress.text }
      });
    }
  });

  engine = await engineInitPromise;
  return engine;
}

interface InferencePayload {
  requestId: string;
  tabId: number;
  messages: { role: string; content: string }[];
}

/**
 * Validate an inference payload before trusting it.
 * Returns null if invalid.
 */
function validatePayload(raw: unknown): InferencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  if (typeof p.requestId !== "string" || p.requestId.length > 64) return null;
  if (typeof p.tabId !== "number" || p.tabId <= 0) return null;
  if (!Array.isArray(p.messages) || p.messages.length === 0 || p.messages.length > 4) return null;

  for (const msg of p.messages) {
    if (!msg || typeof msg !== "object") return null;
    const m = msg as Record<string, unknown>;
    if (typeof m.role !== "string") return null;
    if (!["system", "user", "assistant"].includes(m.role)) return null;
    if (typeof m.content !== "string") return null;
    if (m.content.length > 8000) return null; // guard against content-bomb
  }

  return p as unknown as InferencePayload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "PING_OFFSCREEN") {
    sendResponse({ ok: true, status: engine ? "ready" : "uninitialized" });
    return;
  }

  if (message.type === "OFFSCREEN_AI_REQUEST") {
    const payload = validatePayload(message.payload);
    if (!payload) {
      sendResponse({ ok: false, error: "Invalid payload" });
      return;
    }
    handleInferenceRequest(payload);
    sendResponse({ ok: true, message: "Stream started" });
    return true;
  }
});

async function handleInferenceRequest(payload: InferencePayload): Promise<void> {
  const { requestId, messages, tabId } = payload;

  try {
    const mlc = await getEngine();

    const chunks = await mlc.chat.completions.create({
      messages: messages as ChatCompletionMessageParam[],
      stream: true,
      temperature: 0.6,
      max_tokens: 512
    });

    for await (const chunk of chunks) {
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) {
        chrome.runtime.sendMessage({
          type: "OFFSCREEN_AI_STREAM_CHUNK",
          payload: { requestId, text: content, tabId }
        });
      }
    }

    chrome.runtime.sendMessage({
      type: "OFFSCREEN_AI_STREAM_DONE",
      payload: { requestId, tabId }
    });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown inference error";
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_AI_STREAM_ERROR",
      payload: { requestId, error: errMsg, tabId }
    });
  }
}
