/**
 * pageAnalyzer.ts — Content Graph with 3-Phase Extraction
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Phase 1: DOM → ContentGraph                                ║
 * ║    Walk DOM, create typed GraphNodes, parent-child links    ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Phase 2: Graph Pruning (DSA passes)                        ║
 * ║    P1: Deduplication  — fingerprint hashing (djb2)          ║
 * ║    P2: Noise filter   — separators / buttons / nav crumbs   ║
 * ║    P3: Loop/repeat    — detect repeated identical subtrees   ║
 * ║    P4: Scoring        — token-value heuristic, prune low    ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Phase 3: Graph → Markdown                                  ║
 * ║    DFS with char budget, per-type serialization             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// Public Types
export type SelectionContext = { text: string; surroundingText?: string };
export type PageContext = {
  url: string;
  title: string;
  language?: string;
  markdown: string;
  selectionContext?: SelectionContext;
};
// Legacy compat exports
export type Section = { heading: string; text: string };
export type ContentNode = {
  level: number;
  heading: string;
  text: string;
  links: { label: string; href: string }[];
  children: ContentNode[];
};

// Graph Types
type NodeKind =
  | 'heading'
  | 'paragraph'
  | 'link'
  | 'image'
  | 'list'
  | 'list-item'
  | 'table'
  | 'code'
  | 'quote'
  | 'chip'
  | 'hr'
  | 'root';

interface GNode {
  id: number;
  kind: NodeKind;
  text: string; // normalized text content
  level?: number; // heading level 1-6
  href?: string; // links
  src?: string; // images
  ordered?: boolean; // lists
  hash: number; // djb2 fingerprint of text
  children: number[]; // child GNode ids
  parent: number; // parent GNode id (-1 for root)
  pruned: boolean;
}

// Configuration
const MAX_CHARS = 4500; // tighter budget — small model has ~2048 tokens
const MAX_ITEM_CHARS = 180;
const MAX_SURROUNDING = 300;

// Elements whose entire subtree is skipped
const SKIP_TREE = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'IFRAME',
  'NAV',
  'FOOTER',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'HEAD',
  'META',
  'LINK',
  'BASE',
  'BUTTON',
  'SELECT',
  'FORM',
  'OBJECT',
  'EMBED',
]);

// Noise text patterns — single-char separators, arrows, etc.
const NOISE_RE = /^[\s\u00a0›»·|><\/\\→←\-–—\.,:;!?&^*@#$%(){}\[\]]*$/u;

// Phrases that are always noise regardless of context
const NOISE_PHRASES = new Set([
  'sponsored',
  'advertisement',
  'ad',
  'promoted',
  'skip to main',
  'skip to content',
  'back to top',
  'add to cart',
  'add to wishlist',
  'add to wish list',
  'buy now',
  'shop now',
  'sign in',
  'log in',
  'register',
  'cookie',
  'accept all',
  'decline',
]);

// djb2 Hash
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h;
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Selection Tracker
let lastSelection: SelectionContext | undefined;

function trackSelection(): void {
  if (document.getElementById('eb-sel-marker')) return;
  const m = document.createElement('div');
  m.id = 'eb-sel-marker';
  m.style.display = 'none';
  document.documentElement.appendChild(m);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      lastSelection = undefined;
      return;
    }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) {
      lastSelection = undefined;
      return;
    }
    const anchor = sel.anchorNode;
    const parent =
      anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element | null);
    const ctx = ((parent as HTMLElement)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const idx = ctx.indexOf(text);
    const surrounding =
      idx >= 0
        ? ctx.slice(
          Math.max(0, idx - MAX_SURROUNDING / 2),
          Math.min(ctx.length, idx + text.length + MAX_SURROUNDING / 2),
        )
        : ctx.slice(0, MAX_SURROUNDING);
    lastSelection = { text, surroundingText: surrounding };
  });
}

export function getCurrentSelectionContext(): SelectionContext | undefined {
  return lastSelection;
}

// Phase 1: DOM → ContentGraph
let _nodeId = 0;
const _graph: Map<number, GNode> = new Map();

function mkNode(kind: NodeKind, text: string, parent: number, extra?: Partial<GNode>): GNode {
  const id = ++_nodeId;
  const norm = normalizeText(text);
  const node: GNode = {
    id,
    kind,
    text: norm,
    hash: djb2(norm),
    children: [],
    parent,
    pruned: false,
    ...extra,
  };
  _graph.set(id, node);
  if (parent >= 0) _graph.get(parent)?.children.push(id);
  return node;
}

/**
 * SVG-safe text extraction from any element.
 * Reads only Text nodes, skipping SVG/STYLE subtrees.
 */
function extractText(el: Element, limit = MAX_ITEM_CHARS): string {
  const parts: string[] = [];
  let total = 0;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const t = (n as Element).tagName;
        if (SKIP_TREE.has(t) || t === 'SVG' || t === 'STYLE' || t === 'SCRIPT')
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      const txt = (n as Text).textContent?.trim();
      return txt ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let n: Node | null;
  while ((n = tw.nextNode()) && total < limit) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t) {
        parts.push(t);
        total += t.length + 1;
      }
    }
  }
  return parts.join(' ').trim();
}

function isVisible(el: Element): boolean {
  const h = el as HTMLElement;
  if (!h.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') return false;
  const cs = window.getComputedStyle(h);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
}

function isInlineChip(el: Element): boolean {
  const cs = window.getComputedStyle(el as HTMLElement);
  const disp = cs.display;
  if (!disp.startsWith('inline')) return false;
  const text = extractText(el, 40);
  if (!text || text.length < 1 || text.length > 35) return false;
  return !Array.from(el.children).some((c) => {
    const d = window.getComputedStyle(c).display;
    return d === 'block' || d === 'flex' || d === 'grid';
  });
}

/**
 * Recursive DOM walker — builds the graph.
 */
function walkDOM(el: Element, parentId: number): void {
  if (!isVisible(el)) return;
  const tag = el.tagName;
  if (SKIP_TREE.has(tag)) return;

  // Headings
  if (/^H[1-6]$/.test(tag)) {
    const text = extractText(el, 150);
    if (!text) return;
    mkNode('heading', text, parentId, { level: parseInt(tag[1], 10) });
    return; // don't recurse into heading children
  }

  // Links
  if (tag === 'A') {
    const anchor = el as HTMLAnchorElement;
    const href = anchor.href;
    const text = extractText(anchor, 80);
    if (text && href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      mkNode('link', text, parentId, { href });
    }
    return;
  }

  // Images
  if (tag === 'IMG') {
    const img = el as HTMLImageElement;
    const alt = (img.alt || img.title || '').trim().slice(0, 80);
    if (alt) mkNode('image', alt, parentId, { src: img.src });
    return;
  }

  // Inline code
  if (tag === 'CODE' && el.parentElement?.tagName !== 'PRE') {
    const text = extractText(el, 100);
    if (text) mkNode('code', text, parentId);
    return;
  }

  // Code block
  if (tag === 'PRE') {
    const text = (el as HTMLElement).innerText?.trim().slice(0, 400) ?? '';
    if (text) mkNode('code', text, parentId);
    return;
  }

  // Blockquote
  if (tag === 'BLOCKQUOTE') {
    const text = extractText(el, 300);
    if (text) mkNode('quote', text, parentId);
    return;
  }

  // Table
  if (tag === 'TABLE') {
    const tableNode = mkNode('table', '', parentId);
    const rows = Array.from(el.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      const rowText = cells.map((c) => extractText(c, 60)).join(' | ');
      if (rowText.trim()) mkNode('list-item', rowText, tableNode.id);
    }
    return;
  }

  // Lists
  if (tag === 'UL' || tag === 'OL') {
    const listNode = mkNode('list', '', parentId, { ordered: tag === 'OL' });
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'LI') {
        const text = extractText(child, MAX_ITEM_CHARS);
        if (text) {
          const item = mkNode('list-item', text, listNode.id);
          // Recurse into nested lists
          const nested = child.querySelector('ul, ol');
          if (nested) walkDOM(nested, item.id);
        }
      }
    }
    return;
  }

  // HR
  if (tag === 'HR') {
    mkNode('hr', '---', parentId);
    return;
  }

  // Inline chip/badge spans
  if (tag === 'SPAN' && isInlineChip(el)) {
    const text = extractText(el, 40);
    if (text) mkNode('chip', text, parentId);
    return;
  }

  // Paragraphs and other leaf-level semantic elements
  if (['P', 'DT', 'DD', 'FIGCAPTION', 'LABEL', 'CAPTION', 'ADDRESS'].includes(tag)) {
    const text = extractText(el, MAX_ITEM_CHARS);
    if (text && text.length >= 3) mkNode('paragraph', text, parentId);
    return;
  }

  // Container elements — recurse into children
  for (const child of Array.from(el.children)) {
    walkDOM(child as Element, parentId);
  }
}

// Phase 2: Graph Pruning
/**
 * P1: Remove duplicate content using djb2 hashes.
 *     First occurrence wins; subsequent identical nodes are pruned.
 */
function pruneDedup(rootId: number): void {
  const seen = new Set<number>();
  const queue: number[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = _graph.get(id);
    if (!node || node.pruned) continue;
    if (node.kind !== 'root' && node.text) {
      if (seen.has(node.hash)) {
        node.pruned = true;
        continue;
      }
      seen.add(node.hash);
    }
    queue.push(...node.children);
  }
}

/**
 * P2: Noise filter — remove nav separators, UI labels, short noise.
 */
function pruneNoise(rootId: number): void {
  const queue: number[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = _graph.get(id);
    if (!node || node.pruned) continue;
    const t = node.text;

    // Pure noise chars / separators
    if (t && NOISE_RE.test(t)) {
      node.pruned = true;
      continue;
    }

    // UI noise phrases
    if (t && NOISE_PHRASES.has(t.toLowerCase())) {
      node.pruned = true;
      continue;
    }

    // Very short non-link, non-heading text (single words like ">", "1", "$")
    if (t && t.length < 3 && !['link', 'chip', 'heading', 'hr', 'image'].includes(node.kind)) {
      node.pruned = true;
      continue;
    }

    // Pure numeric strings (quantity selectors: "1 2 3 4 5 6 7 8 9 10")
    if (t && /^[\d\s]+$/.test(t) && node.kind !== 'code') {
      node.pruned = true;
      continue;
    }

    queue.push(...node.children);
  }
}

/**
 * P3: Repeated-subtree pruning (loop detection).
 *     If a list has many items with identical or very similar hashes, keep only unique ones.
 */
function pruneRepetition(rootId: number): void {
  const queue: number[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = _graph.get(id);
    if (!node || node.pruned) continue;

    if (node.kind === 'list' || node.kind === 'table') {
      const childHashes = new Set<number>();
      for (const cid of node.children) {
        const child = _graph.get(cid);
        if (!child || child.pruned) continue;
        if (childHashes.has(child.hash)) {
          child.pruned = true; // deduplicate repeated list items
        } else {
          childHashes.add(child.hash);
        }
      }
    }

    queue.push(...node.children);
  }
}

/**
 * P4: Information scoring.
 *     Score = text length + child count heuristic.
 *     Prune empty containers (lists/tables with all children pruned).
 */
function pruneEmpty(rootId: number): void {
  // Post-order DFS — process leaves first
  const order: number[] = [];
  const stack: number[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    order.push(id);
    const node = _graph.get(id);
    if (node) stack.push(...node.children);
  }
  for (const id of order.reverse()) {
    const node = _graph.get(id);
    if (!node || node.pruned) continue;
    if (['list', 'table', 'root'].includes(node.kind)) {
      const hasLiveChild = node.children.some((cid) => {
        const c = _graph.get(cid);
        return c && !c.pruned;
      });
      if (!hasLiveChild && node.kind !== 'root') node.pruned = true;
    }
  }
}

// Phase 3: Graph → Markdown
interface Budget {
  chars: number;
}

function serializeGraph(nodeId: number, budget: Budget): string {
  if (budget.chars <= 0) return '';
  const node = _graph.get(nodeId);
  if (!node || node.pruned) return '';

  const parts: string[] = [];

  switch (node.kind) {
    case 'root': {
      for (const cid of node.children) {
        if (budget.chars <= 0) break;
        const child = serializeGraph(cid, budget);
        if (child) parts.push(child);
      }
      break;
    }
    case 'heading': {
      const lvl = Math.min(node.level ?? 2, 6);
      const out = '\n' + '#'.repeat(lvl) + ' ' + node.text;
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'paragraph': {
      budget.chars -= node.text.length;
      parts.push('\n' + node.text);
      break;
    }
    case 'link': {
      const out = `[${node.text}](${node.href})`;
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'image': {
      if (!node.src) break;
      const out = `![${node.text}](${node.src})`;
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'code': {
      const out = node.text.includes('\n') ? `\n\`\`\`\n${node.text}\n\`\`\`` : `\`${node.text}\``;
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'quote': {
      const out = '\n> ' + node.text.replace(/\n/g, '\n> ');
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'hr': {
      parts.push('\n---');
      budget.chars -= 4;
      break;
    }
    case 'chip': {
      const out = ` \`${node.text}\``;
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
    case 'list': {
      const listLines: string[] = ['\n'];
      let counter = 1;
      for (const cid of node.children) {
        if (budget.chars <= 0) break;
        const child = _graph.get(cid);
        if (!child || child.pruned) continue;
        const prefix = node.ordered ? `${counter++}. ` : '- ';
        const line = prefix + child.text;
        listLines.push(line);
        budget.chars -= line.length;

        // Nested list items
        const nested = child.children.flatMap((ncid) => {
          const nc = _graph.get(ncid);
          return nc && !nc.pruned ? ['  - ' + nc.text] : [];
        });
        listLines.push(...nested);
        nested.forEach((nl) => {
          budget.chars -= nl.length;
        });
      }
      if (listLines.length > 1) parts.push(listLines.join('\n'));
      break;
    }
    case 'table': {
      const rows = node.children
        .map((cid) => _graph.get(cid))
        .filter((c): c is GNode => !!c && !c.pruned);
      if (!rows.length) break;

      const headerRow = '| ' + rows[0].text.split(' | ').join(' | ') + ' |';
      const separator =
        '| ' +
        rows[0].text
          .split(' | ')
          .map(() => '---')
          .join(' | ') +
        ' |';
      const dataRows = rows.slice(1).map((r) => '| ' + r.text.split(' | ').join(' | ') + ' |');
      const out = '\n' + [headerRow, separator, ...dataRows].join('\n');
      budget.chars -= out.length;
      parts.push(out);
      break;
    }
  }

  return parts.join(' ').replace(/\n{3,}/g, '\n\n');
}

// Content Root Detection
function findContentRoot(): Element {
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '[role="article"]',
    '#main-content',
    '#content',
    '#main',
    '#app',
    '#root',
    '.main-content',
    '.content',
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && isVisible(el)) return el;
  }
  return document.body;
}

// Public API
export function buildPageContext(): PageContext {
  trackSelection();

  // Reset graph state for fresh extraction
  _nodeId = 0;
  _graph.clear();

  const url = window.location.href;
  const title = document.title ?? '';
  const lang = document.documentElement.getAttribute('lang') ?? undefined;

  // Phase 1: Build graph
  const root = mkNode('root', '', -1);
  const contentEl = findContentRoot();
  walkDOM(contentEl, root.id);

  // Phase 2: Prune graph (4 passes)
  pruneDedup(root.id);
  pruneNoise(root.id);
  pruneRepetition(root.id);
  pruneEmpty(root.id);

  // Phase 3: Serialize to Markdown
  const budget: Budget = { chars: MAX_CHARS };
  const raw = serializeGraph(root.id, budget);
  const markdown = raw.replace(/\n{3,}/g, '\n\n').trim();

  const context: PageContext = { url, title, language: lang, markdown };
  if (lastSelection) context.selectionContext = lastSelection;

  const graphSize = _graph.size;
  const pruned = [..._graph.values()].filter((n) => n.pruned).length;
  console.debug(
    `[EzyBuddy] graph: ${graphSize} nodes, ${pruned} pruned → ${markdown.length} chars`,
  );
  try {
    (window as any).ezybuddyContext = context;
  } catch { }

  return context;
}
