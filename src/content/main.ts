import { buildPageContext } from './pageAnalyzer';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

// Constants
const EB_ROOT_ID = 'ezybuddy-root';
const EB_PANEL_ID = 'ezybuddy-panel';
const ACCENT = '#5865f2';
const ACCENT_DIM = 'rgba(88,101,242,0.15)';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #5865f2 0%, #8b5cf6 100%)';
const BG_PANEL = 'rgba(15, 17, 20, 0.95)'; // Darker and more opaque for light mode contrast
const BG_SURFACE = 'rgba(15, 17, 20, 0.85)'; // Assistant bubble
const BG_INPUT = 'rgba(0, 0, 0, 0.35)'; // Input box
const TEXT_PRIMARY = '#f2f3f5';
const TEXT_MUTED = '#b5bac1'; // Brighter for better contrast
const BORDER = 'rgba(255,255,255,0.12)';

// State
let modelLoaded = false;
let isOnRight = localStorage.getItem('eb_fab_side') !== 'left'; // default right
let isHidden = localStorage.getItem('eb_fab_hidden') !== 'false';

// Root + Panel DOM refs (hoisted so message listener can access them)
let _root: HTMLDivElement | null = null;
let _panel: HTMLDivElement | null = null;

// Developer Utility: Listen for a custom event from the page to wipe the WebLLM cache
// Usage in console: document.dispatchEvent(new CustomEvent("eb:clear-cache"))
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

// Per-page chat history — stored in sessionStorage, clears on page reload
const MAX_EXCHANGES = 5; // user+assistant pairs to remember
type ChatEntry = { role: 'user' | 'assistant'; text: string };

function historyKey(): string {
  return 'eb_hist_' + location.href;
}

function loadHistory(): ChatEntry[] {
  try {
    const raw = sessionStorage.getItem(historyKey());
    return raw ? (JSON.parse(raw) as ChatEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ChatEntry[]): void {
  // Keep only the last MAX_EXCHANGES pairs (2 messages per exchange)
  const capped = entries.slice(-(MAX_EXCHANGES * 2));
  try {
    sessionStorage.setItem(historyKey(), JSON.stringify(capped));
  } catch { }
}

// Helpers
function css(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

function svg(markup: string): string {
  return markup;
}

/**
 * Cleans raw AI markdown before rendering:
 *  - Unwraps accidental code-fence wrapping
 *  - Strips GFM task-list checkboxes [ ] / [x]
 *  - Deduplicates repeated bullet lines (model loop guard)
 */
function cleanMarkdown(raw: string): string {
  // Unwrap if the whole response is wrapped in a code fence
  let md = raw.replace(/^```[\w]*\n([\s\S]*?)```$/m, '$1').trim();
  // Strip task-list checkbox markers
  md = md.replace(/^(\s*[-*+])\s+\[[ xX]?\]\s*/gm, '$1 ');
  // Deduplicate bullet lines — keep only the first occurrence of each unique line
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

// Show / Hide FAB
function showFAB() {
  if (!_root) return;
  isHidden = false;
  localStorage.setItem('eb_fab_hidden', 'false');
  _root.style.display = 'block';
}
function hideFAB() {
  if (!_root) return;
  isHidden = true;
  localStorage.setItem('eb_fab_hidden', 'true');
  if (_panel) _panel.style.display = 'none';
  _root.style.display = 'none';
}

// Main
function createButton() {
  if (document.getElementById(EB_ROOT_ID)) return;

  // Root container (positions the FAB)
  const root = document.createElement('div');
  root.id = EB_ROOT_ID;
  css(root, {
    position: 'fixed',
    // Restore saved side: default to right
    ...(isOnRight ? { right: '20px', left: 'auto' } : { left: '20px', right: 'auto' }),
    bottom: '20px',
    zIndex: '2147483647',
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    userSelect: 'none',
    display: isHidden ? 'none' : 'block',
  });
  document.documentElement.appendChild(root);
  _root = root;

  // Floating Action Button
  const btn = document.createElement('button');
  btn.title = 'EzyBuddy (double-click to hide)';
  btn.innerHTML = svg(
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  );
  css(btn, {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    border: `1px solid rgba(255,255,255,0.1)`,
    background: BG_PANEL,
    backdropFilter: 'blur(12px)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    boxShadow: `0 8px 32px rgba(88,101,242,0.25), inset 0 0 0 1px rgba(255,255,255,0.05)`,
    transition:
      'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s, background 0.3s',
    touchAction: 'none',
    outline: 'none',
  });
  (btn.style as any).webkitBackdropFilter = 'blur(12px)';

  // Inject the gradient via a pseudo-element style later, or just apply it on hover
  btn.onmouseenter = () => {
    btn.style.background = ACCENT_GRADIENT;
    btn.style.boxShadow = `0 12px 40px rgba(88,101,242,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`;
    btn.style.transform = 'scale(1.05)';
  };
  btn.onmouseleave = () => {
    btn.style.background = BG_PANEL;
    btn.style.boxShadow = `0 8px 32px rgba(88,101,242,0.25), inset 0 0 0 1px rgba(255,255,255,0.05)`;
    btn.style.transform = 'scale(1)';
  };

  // Panel
  const panel = document.createElement('div');
  panel.id = EB_PANEL_ID;
  css(panel, {
    position: 'fixed',
    right: '20px',
    bottom: '74px',
    width: '350px',
    maxHeight: '560px',
    display: 'none',
    flexDirection: 'column',
    borderRadius: '20px',
    background: BG_PANEL,
    backdropFilter: 'blur(24px)',
    border: `1px solid rgba(255,255,255,0.15)`,
    boxShadow: `0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)`,
    overflow: 'hidden',
    zIndex: '2147483647',
    transformOrigin: 'bottom right',
    animation: 'eb-panel-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  });
  (panel.style as any).webkitBackdropFilter = 'blur(24px)';
  document.documentElement.appendChild(panel);
  _panel = panel;

  // Injected styles (markdown + animations + scrollbar)
  const style = document.createElement('style');
  style.textContent = `
    #${EB_PANEL_ID} * { box-sizing: border-box; font-family: "Inter", system-ui, sans-serif !important; }
    #${EB_PANEL_ID} ::-webkit-scrollbar { width: 4px; }
    #${EB_PANEL_ID} ::-webkit-scrollbar-track { background: transparent; }
    #${EB_PANEL_ID} ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .eb-md { font-size: 13px; line-height: 1.6; color: ${TEXT_MUTED} !important; }
    .eb-md h1,.eb-md h2,.eb-md h3 { margin: 8px 0 4px; font-weight: 600; color: ${TEXT_PRIMARY} !important; }
    .eb-md h2 { font-size: 14px; border-bottom: 1px solid ${BORDER}; padding-bottom: 4px; }
    .eb-md h3 { font-size: 13px; }
    .eb-md p  { margin: 4px 0; color: ${TEXT_MUTED} !important; }
    .eb-md ul,.eb-md ol { margin: 4px 0 4px 16px; padding: 0; color: ${TEXT_MUTED} !important; }
    .eb-md li { margin: 3px 0; color: ${TEXT_MUTED} !important; }
    .eb-md li::marker { color: ${ACCENT} !important; }
    .eb-md a  { color: ${ACCENT} !important; text-decoration: none; }
    .eb-md a:hover { text-decoration: underline; }
    .eb-md strong { color: ${TEXT_PRIMARY} !important; font-weight: 600; }
    .eb-md code { background: rgba(88,101,242,0.12) !important; color: #b9beff !important; padding: 2px 5px; border-radius: 4px; font-size: 11.5px; font-family: 'SF Mono', Menlo, Consolas, monospace !important; }
    .eb-md pre  { background: #111214; border: 1px solid ${BORDER}; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 6px 0; }
    .eb-md pre code { background: none; padding: 0; color: #cdd2fa; }
    .eb-md blockquote { border-left: 3px solid ${ACCENT}; margin: 6px 0; padding: 4px 10px; color: ${TEXT_MUTED}; background: ${ACCENT_DIM}; border-radius: 0 6px 6px 0; }
    .eb-md table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; }
    .eb-md th,.eb-md td { border: 1px solid ${BORDER}; padding: 4px 8px; text-align: left; }
    .eb-md th { background: rgba(88,101,242,0.08); color: ${TEXT_PRIMARY}; font-weight: 600; }
    .eb-md input[type="checkbox"] { display: none; }
    .eb-md hr { border: none; border-top: 1px solid ${BORDER}; margin: 8px 0; }
    @keyframes eb-pulse { 0%,80%,100% { opacity:0.3; transform:scale(0.75); } 40% { opacity:1; transform:scale(1); } }
    @keyframes eb-slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes eb-panel-in { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .eb-bubble-anim { animation: eb-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .eb-dot { display:inline-block; width:5px; height:5px; border-radius:50%; background:${ACCENT}; margin:0 2px; animation:eb-pulse 1.3s ease infinite; }
    .eb-dot:nth-child(2) { animation-delay:.18s; }
    .eb-dot:nth-child(3) { animation-delay:.36s; }
  `;
  panel.appendChild(style);

  // Header
  const header = document.createElement('div');
  css(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px 11px',
    borderBottom: `1px solid ${BORDER}`,
    background: BG_SURFACE,
  });

  const titleWrap = document.createElement('div');
  css(titleWrap, { display: 'flex', alignItems: 'center', gap: '8px' });

  const dot = document.createElement('div');
  css(dot, {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#23a55a',
    boxShadow: '0 0 6px rgba(35,165,90,0.7)',
    flexShrink: '0',
  });

  const titleEl = document.createElement('span');
  titleEl.textContent = 'EzyBuddy';
  css(titleEl, {
    fontSize: '13.5px',
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: '0.2px',
  });

  titleWrap.append(dot, titleEl);

  // Shared button style helper for header icon buttons
  const headerBtnStyle = {
    border: 'none',
    background: 'transparent',
    color: TEXT_MUTED,
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    transition: 'color 0.15s, background 0.15s',
  };

  const clearBtn = document.createElement('button');
  clearBtn.title = 'Clear chat history';
  clearBtn.innerHTML = svg(
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  );
  css(clearBtn, headerBtnStyle);
  clearBtn.onmouseenter = () => {
    clearBtn.style.color = '#f87171';
    clearBtn.style.background = 'rgba(248,113,113,0.08)';
  };
  clearBtn.onmouseleave = () => {
    clearBtn.style.color = TEXT_MUTED;
    clearBtn.style.background = 'transparent';
  };
  clearBtn.onclick = () => {
    messages.innerHTML = '';
    chatHistory = [];
    try {
      sessionStorage.removeItem(historyKey());
    } catch { }
  };

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = svg(
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  );
  css(closeBtn, headerBtnStyle);
  closeBtn.onmouseenter = () => {
    closeBtn.style.color = TEXT_PRIMARY;
    closeBtn.style.background = 'rgba(255,255,255,0.06)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.color = TEXT_MUTED;
    closeBtn.style.background = 'transparent';
  };
  closeBtn.onclick = () => {
    panel.style.display = 'none';
  };

  const profileBtn = document.createElement('button');
  profileBtn.title = 'Settings / Profile';
  profileBtn.innerHTML = svg(
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  );
  css(profileBtn, headerBtnStyle);
  profileBtn.onmouseenter = () => {
    profileBtn.style.color = TEXT_PRIMARY;
    profileBtn.style.background = 'rgba(255,255,255,0.06)';
  };
  profileBtn.onmouseleave = () => {
    profileBtn.style.color = TEXT_MUTED;
    profileBtn.style.background = 'transparent';
  };
  profileBtn.onclick = () => {
    // Open onboarding form pre-filled with current data
    if (userProfile) {
      (document.getElementById('eb-ob-name') as HTMLInputElement).value = userProfile.name || '';
      (document.getElementById('eb-ob-prof') as HTMLInputElement).value =
        userProfile.profession || '';
      (document.getElementById('eb-ob-int') as HTMLInputElement).value =
        userProfile.interests || '';
    }
    const btn = document.getElementById('eb-ob-submit') as HTMLButtonElement;
    if (btn) btn.textContent = 'Save Profile';

    // We can't call setOnboardingMode here directly because it's defined later,
    // so we'll dispatch an event or just expose a global-ish function later.
    // For now, let's just dispatch a custom event.
    panel.dispatchEvent(new CustomEvent('eb:open-onboarding'));
  };

  const headerActions = document.createElement('div');
  css(headerActions, { display: 'flex', alignItems: 'center', gap: '2px' });
  headerActions.append(profileBtn, clearBtn, closeBtn);

  header.append(titleWrap, headerActions);

  // ─ Quick Actions (chips)
  type UserProfile = {
    name: string;
    profession: string;
    interests: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  let userProfile: UserProfile | null = null;

  const quick = document.createElement('div');
  css(quick, {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    borderBottom: `1px solid ${BORDER}`,
    flexWrap: 'wrap',
  });

  function makeChip(label: string, getValues: () => { display: string; query: string }) {
    const chip = document.createElement('button');
    chip.textContent = label;
    css(chip, {
      border: `1px solid rgba(88,101,242,0.25)`,
      borderRadius: '6px',
      padding: '4px 10px',
      fontSize: '11.5px',
      fontWeight: '500',
      cursor: 'pointer',
      background: ACCENT_DIM,
      color: '#b9beff',
      transition: 'all 0.15s',
      outline: 'none',
    });
    chip.onmouseenter = () => {
      chip.style.background = `rgba(88,101,242,0.25)`;
      chip.style.color = TEXT_PRIMARY;
    };
    chip.onmouseleave = () => {
      chip.style.background = ACCENT_DIM;
      chip.style.color = '#b9beff';
    };
    chip.onclick = () => {
      const { display, query } = getValues();
      handleSend(display, query);
    };
    return chip;
  }

  quick.appendChild(
    makeChip('Summarize', () => ({
      display: 'Summarize this page in a few bullet points',
      query: 'Summarize this page in a few bullet points',
    })),
  );
  quick.appendChild(
    makeChip('Key points', () => ({
      display: 'List the key points of this page as bullet points',
      query: 'List the key points of this page as bullet points',
    })),
  );

  // "Why useful for me?" — personalized chip
  const whyChip = makeChip('Why useful for me?', () => {
    const display = 'Why is this useful for me?';

    const prof = userProfile?.profession;
    const int = userProfile?.interests;

    if (!prof && !int) {
      return {
        display,
        query: 'Explain in 2-3 bullet points why this page might be useful to a general reader.',
      };
    }

    const contextParts = [];
    if (prof) contextParts.push(`a ${prof}`);
    if (int) contextParts.push(`interested in ${int}`);

    return {
      display,
      query: `Given I am ${contextParts.join(' and ')}, explain exactly why this page is useful to me. 2-3 short, punchy bullet points only. No fluff.`,
    };
  });
  quick.appendChild(whyChip);

  // Messages
  const messages = document.createElement('div');
  css(messages, {
    flex: '1',
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '13px',
  });

  // Composer
  const composer = document.createElement('div');
  css(composer, {
    display: 'flex',
    padding: '10px 12px',
    gap: '8px',
    background: BG_INPUT,
    borderTop: `1px solid ${BORDER}`,
    alignItems: 'center',
  });

  // ─ Onboarding Overlay
  const onboarding = document.createElement('div');
  css(onboarding, {
    // normal flow so the panel sizes around it without scrollbars
    background: BG_SURFACE,
    display: 'none',
    flexDirection: 'column',
    padding: '24px',
    justifyContent: 'center',
    position: 'relative',
  });

  onboarding.innerHTML = `
    <button id="eb-ob-close" style="position: absolute; top: 12px; right: 12px; border: none; background: transparent; color: ${TEXT_MUTED}; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 6px; outline: none;">
      ${svg(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`)}
    </button>
    <h2 style="margin: 0 0 8px; font-size: 18px; color: ${TEXT_PRIMARY}; font-weight: 600;">Welcome to EzyBuddy</h2>
    <p style="margin: 0 0 20px; font-size: 13px; color: ${TEXT_MUTED}; line-height: 1.5;">Tell me a bit about yourself so I can personalize my answers to your context.</p>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <input id="eb-ob-name" type="text" placeholder="Your Name (Optional)" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid ${BORDER}; background: ${BG_INPUT}; color: ${TEXT_PRIMARY}; font-size: 13px; outline: none; font-family: inherit;">
      <input id="eb-ob-prof" type="text" placeholder="Profession (e.g. Software Engineer)" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid ${BORDER}; background: ${BG_INPUT}; color: ${TEXT_PRIMARY}; font-size: 13px; outline: none; font-family: inherit;">
      <input id="eb-ob-int" type="text" placeholder="Primary interests (e.g. AI, React, Crypto)" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid ${BORDER}; background: ${BG_INPUT}; color: ${TEXT_PRIMARY}; font-size: 13px; outline: none; font-family: inherit;">
      <button id="eb-ob-submit" style="margin-top: 8px; width: 100%; padding: 10px; border-radius: 6px; border: none; background: ${ACCENT}; color: white; font-weight: 500; font-size: 13px; cursor: pointer; transition: opacity 0.2s;">Save Profile</button>
    </div>
  `;
  panel.appendChild(onboarding);

  function setOnboardingMode(show: boolean) {
    if (show) {
      onboarding.style.display = 'flex';
      header.style.display = 'none';
      quick.style.display = 'none';
      messages.style.display = 'none';
      composer.style.display = 'none';
    } else {
      onboarding.style.display = 'none';
      header.style.display = 'flex';
      quick.style.display = 'flex';
      messages.style.display = 'flex';
      composer.style.display = 'flex';
    }
  }

  // Listen for the custom event from the profile button to open settings
  panel.addEventListener('eb:open-onboarding', () => {
    setOnboardingMode(true);
  });

  // Load Profile from Storage
  chrome.storage.local.get('ezybuddy:userProfile', (data) => {
    const p = data['ezybuddy:userProfile'] as UserProfile;
    if (p && (p.name || p.profession || p.interests)) {
      userProfile = p;
      setOnboardingMode(false);
    } else {
      setOnboardingMode(true);
    }
  });

  // Close button functionality for onboarding
  const obCloseBtn = onboarding.querySelector('#eb-ob-close') as HTMLButtonElement;
  if (obCloseBtn) {
    obCloseBtn.onmouseenter = () => {
      obCloseBtn.style.color = TEXT_PRIMARY;
      obCloseBtn.style.background = 'rgba(255,255,255,0.06)';
    };
    obCloseBtn.onmouseleave = () => {
      obCloseBtn.style.color = TEXT_MUTED;
      obCloseBtn.style.background = 'transparent';
    };
    obCloseBtn.onclick = () => {
      panel.style.display = 'none';
    };
  }

  onboarding.querySelector('#eb-ob-submit')?.addEventListener('click', () => {
    const btn = onboarding.querySelector('#eb-ob-submit') as HTMLButtonElement;
    btn.textContent = 'Saving...';
    btn.style.opacity = '0.7';

    const name = (onboarding.querySelector('#eb-ob-name') as HTMLInputElement).value.trim();
    const prof = (onboarding.querySelector('#eb-ob-prof') as HTMLInputElement).value.trim();
    const int = (onboarding.querySelector('#eb-ob-int') as HTMLInputElement).value.trim();

    userProfile = { name, profession: prof, interests: int };
    chrome.storage.local.set({ 'ezybuddy:userProfile': userProfile }, () => {
      setOnboardingMode(false);
    });
  });
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask about this page…';
  css(input, {
    flex: '1',
    borderRadius: '8px',
    border: `1px solid rgba(255,255,255,0.08)`,
    background: BG_INPUT,
    color: TEXT_PRIMARY,
    fontSize: '13px',
    padding: '8px 12px',
    outline: 'none',
    transition: 'border-color 0.15s',
  });
  input.onfocus = () => {
    input.style.borderColor = ACCENT;
  };
  input.onblur = () => {
    input.style.borderColor = 'rgba(255,255,255,0.08)';
  };

  const send = document.createElement('button');
  send.title = 'Send';
  send.innerHTML = svg(
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  );
  css(send, {
    border: 'none',
    background: ACCENT_GRADIENT,
    color: '#fff',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: '0',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 2px 10px rgba(88,101,242,0.3)',
    outline: 'none',
  });
  send.onmouseenter = () => {
    send.style.opacity = '0.9';
    send.style.transform = 'scale(1.06)';
    send.style.boxShadow = '0 4px 12px rgba(88,101,242,0.4)';
  };
  send.onmouseleave = () => {
    send.style.opacity = '1';
    send.style.transform = 'scale(1)';
    send.style.boxShadow = '0 2px 10px rgba(88,101,242,0.3)';
  };

  composer.append(input, send);
  panel.append(header, quick, messages, composer);

  // Push Message (user / assistant bubble)
  function pushMessage(role: 'user' | 'assistant', text: string): HTMLDivElement {
    const bubble = document.createElement('div');
    bubble.className = 'eb-bubble-anim';
    css(bubble, {
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      padding: '10px 14px',
      borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      fontSize: '13px',
      lineHeight: '1.55',
      wordBreak: 'break-word',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      ...(role === 'user'
        ? { background: ACCENT_GRADIENT, color: '#fff' }
        : { background: BG_SURFACE, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }),
    });
    if (role === 'assistant') bubble.classList.add('eb-md');
    if (text) {
      if (role === 'user') bubble.textContent = text;
      else bubble.innerHTML = marked.parse(text) as string;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  // Typing indicator
  function pushTyping(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'eb-bubble-anim';
    el.dataset.typing = 'true';

    if (!modelLoaded) {
      css(el, {
        alignSelf: 'center',
        width: '90%',
        padding: '14px 16px',
        borderRadius: '12px',
        background: BG_SURFACE,
        border: `1px solid rgba(88,101,242,0.2)`,
        textAlign: 'center',
      });
      const status = document.createElement('div');
      status.textContent = 'Downloading AI model (first time only)…';
      status.dataset.role = 'statusText';
      css(status, { fontSize: '12px', color: TEXT_MUTED, marginBottom: '10px' });

      const track = document.createElement('div');
      css(track, {
        width: '100%',
        height: '3px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      });

      const bar = document.createElement('div');
      bar.dataset.role = 'progressBar';
      css(bar, {
        width: '0%',
        height: '100%',
        borderRadius: '999px',
        background: ACCENT,
        transition: 'width 0.3s ease',
      });
      track.appendChild(bar);

      const pct = document.createElement('div');
      pct.dataset.role = 'pctText';
      css(pct, { fontSize: '11px', color: '#5865a0', marginTop: '6px' });

      el.append(status, track, pct);
    } else {
      css(el, {
        alignSelf: 'flex-start',
        padding: '10px 14px',
        borderRadius: '14px 14px 14px 4px',
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
  const activeRequests = new Map<
    string,
    {
      bubble: HTMLDivElement | null;
      typingEl: HTMLDivElement | null;
      rawText: string;
      userText: string;
    }
  >();

  // Send logic
  function handleSend(overrideDisplay?: string, overrideQuery?: string) {
    const displayValue = overrideDisplay ?? input.value.trim();
    const queryValue = overrideQuery ?? displayValue;
    if (!displayValue) return;
    input.value = '';

    // Abort pending requests before starting a new one
    if (activeRequests.size > 0) {
      chrome.runtime.sendMessage({ type: 'ABORT_AI_REQUEST' });
      activeRequests.forEach((req) => {
        req.bubble?.remove();
        req.typingEl?.remove();
      });
      activeRequests.clear();
    }
    pushMessage('user', displayValue);

    const typingEl = pushTyping();
    const requestId = crypto.randomUUID();
    activeRequests.set(requestId, { bubble: null, typingEl, rawText: '', userText: displayValue });

    const pageContext = buildPageContext();

    chrome.runtime.sendMessage(
      {
        type: 'AI_REQUEST',
        payload: { requestId, mode: 'pageQA', query: queryValue, pageContext, userProfile },
      },
      (response) => {
        if (!response?.ok) {
          const req = activeRequests.get(requestId);
          if (req) {
            req.typingEl?.remove();
            pushMessage('assistant', '⚠️ Could not reach the AI engine.');
            activeRequests.delete(requestId);
          }
        }
      },
    );
  }

  send.onclick = () => handleSend();
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      handleSend();
    }
  });

  // Message listener (streaming + progress)
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg?.type) return;

    // Show FAB when extension icon clicked
    if (msg.type === 'SHOW_CHAT') {
      showFAB();
      panel.style.display = 'flex';
      updatePanelPos();
      input.focus();
      return;
    }

    if (msg.type === 'OFFSCREEN_AI_LOAD_PROGRESS') {
      const pct = Math.round((msg.payload?.progress ?? 0) * 100);
      const isCached = msg.payload?.isCached === true;

      // UX refinement: Instead of showing raw WebLLM logs like "Fetching param cache...",
      // show a clean, reassuring message to the user.
      const displayTxt =
        modelLoaded || isCached ? 'Waking up AI engine…' : 'Loading AI model (first time only)';

      if (pct >= 100) modelLoaded = true;

      activeRequests.forEach((req) => {
        const bar = req.typingEl?.querySelector<HTMLElement>('[data-role="progressBar"]');
        const status = req.typingEl?.querySelector<HTMLElement>('[data-role="statusText"]');
        const pctEl = req.typingEl?.querySelector<HTMLElement>('[data-role="pctText"]');
        if (bar) bar.style.width = pct + '%';
        if (status) status.textContent = pct < 100 ? displayTxt : 'Almost ready…';
        if (pctEl) pctEl.textContent = pct + '%';
      });
      return;
    }

    if (msg.type === 'OFFSCREEN_AI_STREAM_CHUNK') {
      const { requestId, text } = msg.payload ?? {};
      const req = activeRequests.get(requestId);
      if (!req) return;
      if (!modelLoaded) modelLoaded = true;
      if (req.typingEl) {
        req.typingEl.remove();
        req.typingEl = null;
      }
      if (!req.bubble) req.bubble = pushMessage('assistant', '');
      req.rawText += text;
      req.bubble.innerHTML = marked.parse(cleanMarkdown(req.rawText)) as string;
      req.bubble.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    if (msg.type === 'OFFSCREEN_AI_STREAM_DONE' || msg.type === 'OFFSCREEN_AI_STREAM_ERROR') {
      const req = activeRequests.get(msg.payload?.requestId);
      if (!req) return;
      req.typingEl?.remove();
      if (msg.type === 'OFFSCREEN_AI_STREAM_ERROR' && !req.bubble) {
        pushMessage('assistant', `⚠️ ${msg.payload?.error ?? 'Error'}`);
      }
      // Save this exchange to history
      if (msg.type === 'OFFSCREEN_AI_STREAM_DONE' && req.rawText) {
        chatHistory.push({ role: 'user', text: req.userText });
        chatHistory.push({ role: 'assistant', text: cleanMarkdown(req.rawText) });
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
    messages.innerHTML = '';
    // Load history for the new URL
    chatHistory = loadHistory();
    for (const entry of chatHistory) {
      pushMessage(entry.role, entry.text);
    }
  }
  window.addEventListener('popstate', () => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      onUrlChange();
    }
  });
  // Polling fallback for pushState-based routers (React, Nextwhy .js etc.)
  setInterval(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      onUrlChange();
    }
  }, 600);

  // FAB: drag (horizontal only, snaps to left/right bottom) + double-click to hide
  let dragging = false;
  let hasMoved = false;
  let startPointerX = 0;

  btn.addEventListener('pointerdown', (e) => {
    dragging = true;
    hasMoved = false;
    startPointerX = e.clientX;
    btn.style.cursor = 'grabbing';
    btn.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  btn.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = Math.abs(e.clientX - startPointerX);
    if (dx > 6) hasMoved = true;
    // Only update side indicator during drag — snap on release
  });

  btn.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    btn.style.cursor = 'grab';

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
  btn.addEventListener('click', (e) => {
    if (hasMoved) {
      hasMoved = false;
      return;
    } // was a drag release

    const now = Date.now();
    if (now - lastClickTime < 350) {
      // Double-click: hide FAB entirely
      hideFAB();
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;

    // Single click: toggle panel
    const open = panel.style.display !== 'none' && panel.style.display !== '';
    panel.style.display = open ? 'none' : 'flex';
    if (!open) {
      updatePanelPos();
      setTimeout(() => input.focus(), 50);
    }
  });

  function snapLeft() {
    isOnRight = false;
    localStorage.setItem('eb_fab_side', 'left');
    root.style.left = '20px';
    root.style.right = 'auto';
    root.style.bottom = '20px';
    root.style.top = 'auto';
  }

  function snapRight() {
    isOnRight = true;
    localStorage.setItem('eb_fab_side', 'right');
    root.style.right = '20px';
    root.style.left = 'auto';
    root.style.bottom = '20px';
    root.style.top = 'auto';
  }

  function updatePanelPos() {
    panel.style.bottom = '74px';
    panel.style.top = 'auto';
    if (isOnRight) {
      panel.style.right = '20px';
      panel.style.left = 'auto';
    } else {
      panel.style.left = '20px';
      panel.style.right = 'auto';
    }
  }

  root.appendChild(btn);
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createButton);
} else {
  createButton();
}
