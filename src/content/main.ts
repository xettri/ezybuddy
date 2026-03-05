import { buildPageContext } from "./pageAnalyzer";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

// Constants
const EB_ROOT_ID = "ezybuddy-root";
const EB_PANEL_ID = "ezybuddy-panel";
const ACCENT = "#5865f2"; // Discord-ish indigo — pleasant, professional
const ACCENT_DIM = "rgba(88,101,242,0.15)";
const BG_PANEL = "#18191c";
const BG_SURFACE = "#232428";
const BG_INPUT = "#2b2d31";
const TEXT_PRIMARY = "#f2f3f5";
const TEXT_MUTED = "#949ba4";
const BORDER = "rgba(255,255,255,0.06)";

// State
let modelLoaded = false;
let isOnRight = localStorage.getItem("eb_fab_side") !== "left"; // default right
let isHidden = false;

// Root + Panel DOM refs (hoisted so message listener can access them)
let _root: HTMLDivElement | null = null;
let _panel: HTMLDivElement | null = null;

// Per-page chat history — stored in sessionStorage, clears on page reload
const MAX_EXCHANGES = 5; // user+assistant pairs to remember
type ChatEntry = { role: "user" | "assistant"; text: string };

function historyKey(): string {
  return "eb_hist_" + location.href;
}

function loadHistory(): ChatEntry[] {
  try {
    const raw = sessionStorage.getItem(historyKey());
    return raw ? (JSON.parse(raw) as ChatEntry[]) : [];
  } catch { return []; }
}

function saveHistory(entries: ChatEntry[]): void {
  // Keep only the last MAX_EXCHANGES pairs (2 messages per exchange)
  const capped = entries.slice(-(MAX_EXCHANGES * 2));
  try { sessionStorage.setItem(historyKey(), JSON.stringify(capped)); } catch { }
}

// Helpers
function css(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

function svg(markup: string): string { return markup; }

/**
 * Cleans raw AI markdown before rendering:
 *  - Unwraps accidental code-fence wrapping
 *  - Strips GFM task-list checkboxes [ ] / [x]
 *  - Deduplicates repeated bullet lines (model loop guard)
 */
function cleanMarkdown(raw: string): string {
  // Unwrap if the whole response is wrapped in a code fence
  let md = raw.replace(/^```[\w]*\n([\s\S]*?)```$/m, "$1").trim();
  // Strip task-list checkbox markers
  md = md.replace(/^(\s*[-*+])\s+\[[ xX]?\]\s*/gm, "$1 ");
  // Deduplicate bullet lines — keep only the first occurrence of each unique line
  const seen = new Set<string>();
  md = md.split("\n").filter(line => {
    const isBullet = /^\s*[-*+]\s/.test(line);
    if (!isBullet) return true;
    const key = line.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n");
  return md;
}



// Show / Hide FAB
function showFAB() {
  if (!_root) return;
  isHidden = false;
  _root.style.display = "block";
}
function hideFAB() {
  if (!_root) return;
  isHidden = true;
  if (_panel) _panel.style.display = "none";
  _root.style.display = "none";
}

// Main
function createButton() {
  if (document.getElementById(EB_ROOT_ID)) return;

  // Root container (positions the FAB)
  const root = document.createElement("div");
  root.id = EB_ROOT_ID;
  css(root, {
    position: "fixed",
    // Restore saved side: default to right
    ...(isOnRight
      ? { right: "20px", left: "auto" }
      : { left: "20px", right: "auto" }),
    bottom: "20px",
    zIndex: "2147483647",
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    userSelect: "none",
  });
  document.documentElement.appendChild(root);
  _root = root;

  // Floating Action Button
  const btn = document.createElement("button");
  btn.title = "EzyBuddy (double-click to hide)";
  btn.innerHTML = svg(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`);
  css(btn, {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    border: `1.5px solid ${ACCENT}`,
    background: BG_PANEL,
    color: ACCENT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    boxShadow: `0 4px 24px rgba(88,101,242,0.35), 0 1px 4px rgba(0,0,0,0.5)`,
    transition: "box-shadow 0.2s, background 0.2s",
    touchAction: "none",
    outline: "none",
  });
  btn.onmouseenter = () => { btn.style.background = ACCENT_DIM; btn.style.boxShadow = `0 6px 30px rgba(88,101,242,0.5)`; };
  btn.onmouseleave = () => { btn.style.background = BG_PANEL; btn.style.boxShadow = `0 4px 24px rgba(88,101,242,0.35), 0 1px 4px rgba(0,0,0,0.5)`; };

  // Panel
  const panel = document.createElement("div");
  panel.id = EB_PANEL_ID;
  css(panel, {
    position: "fixed",
    right: "20px",
    bottom: "74px",
    width: "340px",
    maxHeight: "520px",
    display: "none",
    flexDirection: "column",
    borderRadius: "16px",
    background: BG_PANEL,
    border: `1px solid rgba(88,101,242,0.3)`,
    boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${BORDER}`,
    overflow: "hidden",
    zIndex: "2147483647",
  });
  document.documentElement.appendChild(panel);
  _panel = panel;

  // Injected styles (markdown + animations + scrollbar)
  const style = document.createElement("style");
  style.textContent = `
    #${EB_PANEL_ID} * { box-sizing: border-box; }
    #${EB_PANEL_ID} ::-webkit-scrollbar { width: 4px; }
    #${EB_PANEL_ID} ::-webkit-scrollbar-track { background: transparent; }
    #${EB_PANEL_ID} ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .eb-md { font-size: 13px; line-height: 1.6; color: ${TEXT_MUTED}; }
    .eb-md h1,.eb-md h2,.eb-md h3 { margin: 8px 0 4px; font-weight: 600; color: ${TEXT_PRIMARY}; }
    .eb-md h2 { font-size: 14px; border-bottom: 1px solid ${BORDER}; padding-bottom: 4px; }
    .eb-md h3 { font-size: 13px; }
    .eb-md p  { margin: 4px 0; }
    .eb-md ul,.eb-md ol { margin: 4px 0 4px 16px; padding: 0; }
    .eb-md li { margin: 3px 0; }
    .eb-md li::marker { color: ${ACCENT}; }
    .eb-md a  { color: ${ACCENT}; text-decoration: none; }
    .eb-md a:hover { text-decoration: underline; }
    .eb-md strong { color: ${TEXT_PRIMARY}; font-weight: 600; }
    .eb-md code { background: rgba(88,101,242,0.12); color: #b9beff; padding: 2px 5px; border-radius: 4px; font-size: 11.5px; font-family: 'SF Mono', Menlo, Consolas, monospace; }
    .eb-md pre  { background: #111214; border: 1px solid ${BORDER}; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 6px 0; }
    .eb-md pre code { background: none; padding: 0; color: #cdd2fa; }
    .eb-md blockquote { border-left: 3px solid ${ACCENT}; margin: 6px 0; padding: 4px 10px; color: ${TEXT_MUTED}; background: ${ACCENT_DIM}; border-radius: 0 6px 6px 0; }
    .eb-md table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; }
    .eb-md th,.eb-md td { border: 1px solid ${BORDER}; padding: 4px 8px; text-align: left; }
    .eb-md th { background: rgba(88,101,242,0.08); color: ${TEXT_PRIMARY}; font-weight: 600; }
    .eb-md input[type="checkbox"] { display: none; }
    .eb-md hr { border: none; border-top: 1px solid ${BORDER}; margin: 8px 0; }
    @keyframes eb-pulse { 0%,80%,100% { opacity:0.3; transform:scale(0.75); } 40% { opacity:1; transform:scale(1); } }
    .eb-dot { display:inline-block; width:5px; height:5px; border-radius:50%; background:${ACCENT}; margin:0 2px; animation:eb-pulse 1.3s ease infinite; }
    .eb-dot:nth-child(2) { animation-delay:.18s; }
    .eb-dot:nth-child(3) { animation-delay:.36s; }
  `;
  panel.appendChild(style);

  // Header
  const header = document.createElement("div");
  css(header, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px 11px",
    borderBottom: `1px solid ${BORDER}`,
    background: BG_SURFACE,
  });

  const titleWrap = document.createElement("div");
  css(titleWrap, { display: "flex", alignItems: "center", gap: "8px" });

  const dot = document.createElement("div");
  css(dot, { width: "7px", height: "7px", borderRadius: "50%", background: "#23a55a", boxShadow: "0 0 6px rgba(35,165,90,0.7)", flexShrink: "0" });

  const titleEl = document.createElement("span");
  titleEl.textContent = "EzyBuddy";
  css(titleEl, { fontSize: "13.5px", fontWeight: "600", color: TEXT_PRIMARY, letterSpacing: "0.2px" });

  titleWrap.append(dot, titleEl);

  // Shared button style helper for header icon buttons
  const headerBtnStyle = { border: "none", background: "transparent", color: TEXT_MUTED, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", borderRadius: "6px", transition: "color 0.15s, background 0.15s" };

  const clearBtn = document.createElement("button");
  clearBtn.title = "Clear chat history";
  clearBtn.innerHTML = svg(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`);
  css(clearBtn, headerBtnStyle);
  clearBtn.onmouseenter = () => { clearBtn.style.color = "#f87171"; clearBtn.style.background = "rgba(248,113,113,0.08)"; };
  clearBtn.onmouseleave = () => { clearBtn.style.color = TEXT_MUTED; clearBtn.style.background = "transparent"; };
  clearBtn.onclick = () => {
    messages.innerHTML = "";
    chatHistory = [];
    try { sessionStorage.removeItem(historyKey()); } catch { }
  };

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = svg(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`);
  css(closeBtn, headerBtnStyle);
  closeBtn.onmouseenter = () => { closeBtn.style.color = TEXT_PRIMARY; closeBtn.style.background = "rgba(255,255,255,0.06)"; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = TEXT_MUTED; closeBtn.style.background = "transparent"; };
  closeBtn.onclick = () => { panel.style.display = "none"; };

  const headerActions = document.createElement("div");
  css(headerActions, { display: "flex", alignItems: "center", gap: "2px" });
  headerActions.append(clearBtn, closeBtn);

  header.append(titleWrap, headerActions);


  // Quick Actions
  const quick = document.createElement("div");
  css(quick, { display: "flex", gap: "6px", padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" });

  const chips = [
    { label: "Summarize", value: "Summarize this page in a few bullet points" },
    { label: "Key points", value: "List the key points of this page as bullet points" },
    { label: "Explain", value: "Explain what this page is about in simple terms" },
  ];
  for (const { label, value } of chips) {
    const chip = document.createElement("button");
    chip.textContent = label;
    css(chip, {
      border: `1px solid rgba(88,101,242,0.25)`,
      borderRadius: "6px",
      padding: "4px 10px",
      fontSize: "11.5px",
      fontWeight: "500",
      cursor: "pointer",
      background: ACCENT_DIM,
      color: "#b9beff",
      transition: "all 0.15s",
      outline: "none",
    });
    chip.onmouseenter = () => { chip.style.background = `rgba(88,101,242,0.25)`; chip.style.color = TEXT_PRIMARY; };
    chip.onmouseleave = () => { chip.style.background = ACCENT_DIM; chip.style.color = "#b9beff"; };
    chip.onclick = () => { input.value = value; handleSend(); };
    quick.appendChild(chip);
  }

  // Messages
  const messages = document.createElement("div");
  css(messages, {
    flex: "1",
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontSize: "13px",
  });

  // Composer
  const composer = document.createElement("div");
  css(composer, {
    display: "flex",
    padding: "10px 12px",
    borderTop: `1px solid ${BORDER}`,
    background: BG_SURFACE,
    gap: "8px",
    alignItems: "center",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Ask about this page…";
  css(input, {
    flex: "1",
    borderRadius: "8px",
    border: `1px solid rgba(255,255,255,0.08)`,
    background: BG_INPUT,
    color: TEXT_PRIMARY,
    fontSize: "13px",
    padding: "8px 12px",
    outline: "none",
    transition: "border-color 0.15s",
  });
  input.onfocus = () => { input.style.borderColor = ACCENT; };
  input.onblur = () => { input.style.borderColor = "rgba(255,255,255,0.08)"; };

  const send = document.createElement("button");
  send.innerHTML = svg(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`);
  css(send, {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "none",
    background: ACCENT,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: "0",
    transition: "opacity 0.15s, transform 0.15s",
    outline: "none",
  });
  send.onmouseenter = () => { send.style.opacity = "0.85"; send.style.transform = "scale(1.04)"; };
  send.onmouseleave = () => { send.style.opacity = "1"; send.style.transform = "scale(1)"; };

  composer.append(input, send);
  panel.append(header, quick, messages, composer);

  // Push Message (user / assistant bubble)
  function pushMessage(role: "user" | "assistant", text: string): HTMLDivElement {
    const bubble = document.createElement("div");
    css(bubble, {
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      maxWidth: "88%",
      padding: "8px 12px",
      borderRadius: role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
      fontSize: "13px",
      lineHeight: "1.55",
      wordBreak: "break-word",
      ...(role === "user"
        ? { background: ACCENT, color: "#fff" }
        : { background: BG_SURFACE, border: `1px solid ${BORDER}`, color: TEXT_MUTED }),
    });
    if (role === "assistant") bubble.classList.add("eb-md");
    if (text) {
      if (role === "user") bubble.textContent = text;
      else bubble.innerHTML = marked.parse(text) as string;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  // Typing indicator
  function pushTyping(): HTMLDivElement {
    const el = document.createElement("div");
    el.dataset.typing = "true";

    if (!modelLoaded) {
      css(el, {
        alignSelf: "center",
        width: "90%",
        padding: "14px 16px",
        borderRadius: "12px",
        background: BG_SURFACE,
        border: `1px solid rgba(88,101,242,0.2)`,
        textAlign: "center",
      });
      const status = document.createElement("div");
      status.textContent = "Downloading AI model (first time only)…";
      status.dataset.role = "statusText";
      css(status, { fontSize: "12px", color: TEXT_MUTED, marginBottom: "10px" });

      const track = document.createElement("div");
      css(track, { width: "100%", height: "3px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden" });

      const bar = document.createElement("div");
      bar.dataset.role = "progressBar";
      css(bar, { width: "0%", height: "100%", borderRadius: "999px", background: ACCENT, transition: "width 0.3s ease" });
      track.appendChild(bar);

      const pct = document.createElement("div");
      pct.dataset.role = "pctText";
      css(pct, { fontSize: "11px", color: "#5865a0", marginTop: "6px" });

      el.append(status, track, pct);
    } else {
      css(el, {
        alignSelf: "flex-start",
        padding: "10px 14px",
        borderRadius: "14px 14px 14px 4px",
        background: BG_SURFACE,
        border: `1px solid ${BORDER}`,
      });
      el.innerHTML = `<span class="eb-dot"></span><span class="eb-dot"></span><span class="eb-dot"></span>`;
    }

    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // In-memory chat history for this page (mirrored from sessionStorage)
  let chatHistory: ChatEntry[] = loadHistory();

  // Active request tracking
  const activeRequests = new Map<string, { bubble: HTMLDivElement | null; typingEl: HTMLDivElement | null; rawText: string; userText: string }>();

  // Send logic
  function handleSend() {
    const value = input.value.trim();
    if (!value) return;
    input.value = "";
    pushMessage("user", value);

    const typingEl = pushTyping();
    const requestId = crypto.randomUUID();
    activeRequests.set(requestId, { bubble: null, typingEl, rawText: "", userText: value });

    const pageContext = buildPageContext();

    chrome.runtime.sendMessage(
      { type: "AI_REQUEST", payload: { requestId, mode: "pageQA", query: value, pageContext } },
      (response) => {
        if (!response?.ok) {
          const req = activeRequests.get(requestId);
          if (req) {
            req.typingEl?.remove();
            pushMessage("assistant", "⚠️ Could not reach the AI engine.");
            activeRequests.delete(requestId);
          }
        }
      }
    );
  }

  send.onclick = handleSend;
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleSend(); } });

  // Message listener (streaming + progress)
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg?.type) return;

    // Show FAB when extension icon clicked
    if (msg.type === "SHOW_CHAT") {
      showFAB();
      panel.style.display = "flex";
      updatePanelPos();
      input.focus();
      return;
    }

    if (msg.type === "OFFSCREEN_AI_LOAD_PROGRESS") {
      const pct = Math.round((msg.payload?.progress ?? 0) * 100);
      const txt = msg.payload?.text ?? "Loading…";
      if (pct >= 100) modelLoaded = true;
      activeRequests.forEach((req) => {
        const bar = req.typingEl?.querySelector<HTMLElement>('[data-role="progressBar"]');
        const status = req.typingEl?.querySelector<HTMLElement>('[data-role="statusText"]');
        const pctEl = req.typingEl?.querySelector<HTMLElement>('[data-role="pctText"]');
        if (bar) bar.style.width = pct + "%";
        if (status) status.textContent = pct < 100 ? txt : "Almost ready…";
        if (pctEl) pctEl.textContent = pct + "%";
      });
      return;
    }

    if (msg.type === "OFFSCREEN_AI_STREAM_CHUNK") {
      const { requestId, text } = msg.payload ?? {};
      const req = activeRequests.get(requestId);
      if (!req) return;
      if (!modelLoaded) modelLoaded = true;
      if (req.typingEl) { req.typingEl.remove(); req.typingEl = null; }
      if (!req.bubble) req.bubble = pushMessage("assistant", "");
      req.rawText += text;
      req.bubble.innerHTML = marked.parse(cleanMarkdown(req.rawText)) as string;
      req.bubble.querySelectorAll<HTMLAnchorElement>("a").forEach(a => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    if (msg.type === "OFFSCREEN_AI_STREAM_DONE" || msg.type === "OFFSCREEN_AI_STREAM_ERROR") {
      const req = activeRequests.get(msg.payload?.requestId);
      if (!req) return;
      req.typingEl?.remove();
      if (msg.type === "OFFSCREEN_AI_STREAM_ERROR" && !req.bubble) {
        pushMessage("assistant", `⚠️ ${msg.payload?.error ?? "Error"}`);
      }
      // Save this exchange to history
      if (msg.type === "OFFSCREEN_AI_STREAM_DONE" && req.rawText) {
        chatHistory.push({ role: "user", text: req.userText });
        chatHistory.push({ role: "assistant", text: cleanMarkdown(req.rawText) });
        saveHistory(chatHistory);
      }
      activeRequests.delete(msg.payload.requestId);
    }
  });

  // Render saved history for this page on load
  for (const entry of chatHistory) {
    pushMessage(entry.role, entry.text);
  }

  // Watch for URL changes (handles SPA navigation like Next.js / React Router)
  let _lastUrl = location.href;
  function onUrlChange() {
    // Clear visible messages
    messages.innerHTML = "";
    // Load history for the new URL
    chatHistory = loadHistory();
    for (const entry of chatHistory) {
      pushMessage(entry.role, entry.text);
    }
  }
  window.addEventListener("popstate", () => { if (location.href !== _lastUrl) { _lastUrl = location.href; onUrlChange(); } });
  // Polling fallback for pushState-based routers (React, Next.js etc.)
  setInterval(() => {
    if (location.href !== _lastUrl) { _lastUrl = location.href; onUrlChange(); }
  }, 600);

  // FAB: drag (horizontal only, snaps to left/right bottom) + double-click to hide
  let dragging = false;
  let hasMoved = false;
  let startPointerX = 0;

  btn.addEventListener("pointerdown", (e) => {
    dragging = true;
    hasMoved = false;
    startPointerX = e.clientX;
    btn.style.cursor = "grabbing";
    btn.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  btn.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = Math.abs(e.clientX - startPointerX);
    if (dx > 6) hasMoved = true;
    // Only update side indicator during drag — snap on release
  });

  btn.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    btn.style.cursor = "grab";

    if (!hasMoved) return; // handled by click/dblclick

    // Determine nearest horizontal half to snap to
    if (e.clientX < window.innerWidth / 2) {
      snapLeft();
    } else {
      snapRight();
    }
    updatePanelPos();
  });

  // Single click (no drag) — toggle panel
  let lastClickTime = 0;
  btn.addEventListener("click", (e) => {
    if (hasMoved) { hasMoved = false; return; } // was a drag release

    const now = Date.now();
    if (now - lastClickTime < 350) {
      // Double-click: hide FAB entirely
      hideFAB();
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;

    // Single click: toggle panel
    const open = panel.style.display !== "none" && panel.style.display !== "";
    panel.style.display = open ? "none" : "flex";
    if (!open) {
      updatePanelPos();
      setTimeout(() => input.focus(), 50);
    }
  });

  function snapLeft() {
    isOnRight = false;
    localStorage.setItem("eb_fab_side", "left");
    root.style.left = "20px";
    root.style.right = "auto";
    root.style.bottom = "20px";
    root.style.top = "auto";
  }

  function snapRight() {
    isOnRight = true;
    localStorage.setItem("eb_fab_side", "right");
    root.style.right = "20px";
    root.style.left = "auto";
    root.style.bottom = "20px";
    root.style.top = "auto";
  }

  function updatePanelPos() {
    panel.style.bottom = "74px";
    panel.style.top = "auto";
    if (isOnRight) {
      panel.style.right = "20px";
      panel.style.left = "auto";
    } else {
      panel.style.left = "20px";
      panel.style.right = "auto";
    }
  }

  root.appendChild(btn);
}

// Boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createButton);
} else {
  createButton();
}
