/**
 * Tokenizer for game script syntax.
 *
 * Supported tokens (matched in order of priority):
 *   1. [NARR], [MAIN], [LETHE_*], [OPTION] — bracket labels
 *   2. <if ...>, <else>, <...>              — angle-tag constructions
 *   3. {NAME}, {NAME_suffix}, {...}        — curly-tag constructions
 *   4. ----                                  separator
 *
 * Character names and emotions get consistent colors via an aggressive hash.
 * Underscores are highlighted in a default color.
 * Emotions in [] are shown as emoji after the bracket.
 */

export type TokenType =
  | 'separator'
  | 'bracket-label'
  | 'angle-tag'
  | 'curly-tag'
  | 'double-space'
  | 'trailing-space'
  | 'trailing-newline'
  | 'invalid-hyphen';

export interface Token {
  type: TokenType;
  value: string;
  cssClass: string;
  /** Multi-part inner: each part has its own color */
  parts?: Array<{ text: string; color?: string; class?: string }>;
  title?: string;
  suffix?: string;
}

// ---------------------------------------------------------------------------
// Aggressive color hash — sensitive to every character and its case
// ---------------------------------------------------------------------------

const PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#c0392b', '#7f8c8d', '#2c3e50',
  '#e91e63', '#00bcd4', '#ff5722', '#607d8b', '#795548',
  '#4caf50', '#ff9800', '#673ab7', '#03a9f4', '#8bc34a',
  '#ffc107', '#009688', '#f44336', '#2196f3', '#689f38',
];

function aggressiveHash(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  }
  return (4294967296 + (h2 >>> 0)) % PALETTE.length;
}

function hashColor(str: string): string {
  return PALETTE[aggressiveHash(str)];
}

// ---------------------------------------------------------------------------
// Emotion → emoji mapping
// ---------------------------------------------------------------------------

const EMOTION_EMOJI: Record<string, string> = {
  smile: '😊', laugh: '😄', angry: '😠', sad: '😢', cry: '😭',
  love: '😍', kiss: '😘', blush: '😳', wink: '😉', surprised: '😲',
  scared: '😨', thinking: '🤔', confused: '😕', tired: '😴',
  excited: '🤩', smirk: '😏', serious: '😐', nervous: '😰',
  happy: '😃', mad: '😤', hurt: '😖', annoyed: '😒', drunk: '🥴',
  aroused: '😏', shy: '☺️', disgusted: '🤢',
  neutral: '😐', grin: '😁', gasp: '😮', frown: '☹️', pout: '😤',
};

function emotionEmoji(emotion: string): string {
  return EMOTION_EMOJI[emotion.toLowerCase()] || '💬';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function tokenizeLine(line: string): Array<{ text: string; token?: Token }> {
  const result: Array<{ text: string; token?: Token }> = [];
  let remaining = line;

  while (remaining.length > 0) {
    const best = findNextToken(remaining);

    if (!best) {
      result.push({ text: remaining });
      break;
    }

    if (best.index > 0) {
      result.push({ text: remaining.slice(0, best.index) });
    }

    result.push({ text: best.token.value, token: best.token });
    remaining = remaining.slice(best.index + best.token.value.length);
  }

  // Post-process: highlight trailing spaces in the last plain-text segment
  if (result.length > 0) {
    const last = result[result.length - 1];
    if (!last.token) {
      const trailMatch = / +$/.exec(last.text);
      if (trailMatch && trailMatch.index > 0) {
        const before = last.text.slice(0, trailMatch.index);
        const trail = trailMatch[0];
        result.pop();
        if (before) result.push({ text: before });
        result.push({ text: trail, token: { type: 'trailing-space', value: trail, cssClass: 'tok-trailing-space' } });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface Match {
  index: number;
  token: Token;
}

function findNextToken(text: string): Match | null {
  let best: Match | null = null;

  // 1. Separator  ----
  const sepIdx = text.indexOf('----');
  if (sepIdx !== -1) {
    best = { index: sepIdx, token: { type: 'separator', value: '----', cssClass: 'tok-separator' } };
  }

  // 2. [LABEL]
  const bracketRe = /\[([A-Za-z0-9_]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      best = { index: m.index, token: buildBracketToken(m[0], m[1]) };
    }
  }

  // 3. <tag ...>
  const angleRe = /<([A-Za-z/][A-Za-z0-9_ ]*)([^>]*)>/g;
  while ((m = angleRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      const inner = m[1] + m[2];
      best = { index: m.index, token: { type: 'angle-tag', value: m[0], cssClass: 'tok-angle', parts: [{ text: inner, class: 'tok-angle-inner' }] } };
    }
  }

  // 4. {expr}
  const curlyRe = /\{([^}]*)\}/g;
  while ((m = curlyRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      best = { index: m.index, token: buildCurlyToken(m[0], m[1]) };
    }
  }

  // 5. Double spaces
  const doubleSpaceRe = /  +/g;
  while ((m = doubleSpaceRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      best = { index: m.index, token: { type: 'double-space', value: m[0], cssClass: 'tok-double-space' } };
    }
  }

  // 6. Trailing spaces
  const trailingRe = / +$/;
  const trailingMatch = trailingRe.exec(text);
  if (trailingMatch && trailingMatch.index > 0) {
    if (!best || trailingMatch.index < best.index) {
      best = { index: trailingMatch.index, token: { type: 'trailing-space', value: trailingMatch[0], cssClass: 'tok-trailing-space' } };
    }
  }

  // 7. Invalid hyphens (U+002D) — game only accepts minus (U+2212)
  const hyphenRe = /\-/g;
  while ((m = hyphenRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      best = { index: m.index, token: { type: 'invalid-hyphen', value: '-', cssClass: 'tok-invalid' } };
    }
  }

  return best;
}

function buildBracketToken(full: string, inner: string): Token {
  // Special labels: NARR, MAIN, OPTION
  const upper = inner.toUpperCase();
  if (upper === 'NARR' || upper === 'MAIN' || upper === 'OPTION') {
    return {
      type: 'bracket-label', value: full, cssClass: 'tok-bracket',
      parts: [{ text: inner, class: 'tok-bracket-inner tok-bracket-' + lower(upper) }]
    };
  }

  // Character label: [NAME] or [NAME_emotion]
  const underscoreIdx = inner.indexOf('_');

  if (underscoreIdx !== -1) {
    const name = inner.slice(0, underscoreIdx);
    const emotion = inner.slice(underscoreIdx + 1);
    const nameColor = hashColor(name);
    const emotionColor = hashColor(emotion);
    const emoji = emotionEmoji(emotion);
    // Show full text: name + _ + emotion, with different colors
    return {
      type: 'bracket-label', value: full, cssClass: 'tok-bracket',
      parts: [
        { text: name, color: nameColor },
        { text: '_', color: '#6c757d' },
        { text: emotion, color: emotionColor },
      ],
      suffix: emoji
    };
  }

  const color = hashColor(inner);
  return {
    type: 'bracket-label', value: full, cssClass: 'tok-bracket',
    parts: [{ text: inner, color }]
  };
}

function buildCurlyToken(full: string, inner: string): Token {
  const underscoreIdx = inner.indexOf('_');

  if (underscoreIdx !== -1) {
    const name = inner.slice(0, underscoreIdx);
    const suffix = inner.slice(underscoreIdx + 1);
    const nameColor = hashColor(name);
    const suffixColor = hashColor(suffix);
    return {
      type: 'curly-tag', value: full, cssClass: 'tok-curly',
      parts: [
        { text: name, color: nameColor },
        { text: '_', color: '#6c757d' },
        { text: suffix, color: suffixColor },
      ]
    };
  }

  const color = hashColor(inner);
  return {
    type: 'curly-tag', value: full, cssClass: 'tok-curly',
    parts: [{ text: inner, color }]
  };
}

function lower(s: string): string {
  return s.toLowerCase();
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
function esc(s: string): string {
  return s.replace(/[&<>]/g, c => ESC_MAP[c]);
}

function renderParts(parts: Array<{ text: string; color?: string; class?: string }>): string {
  return parts.map(p => {
    const cls = p.class ? ' class="' + p.class + '"' : '';
    const style = p.color ? ' style="color:' + p.color + '"' : '';
    return '<span' + cls + style + '>' + esc(p.text) + '</span>';
  }).join('');
}

export function renderLineHtml(line: string): string {
  if (line.length === 0) return '&nbsp;';

  // Step 1: Always split off trailing spaces first
  const trailMatch = / +$/.exec(line);
  const content = trailMatch ? line.slice(0, trailMatch.index) : line;
  const trail = trailMatch ? trailMatch[0] : '';

  if (content.length === 0) {
    // Line is only spaces
    return '<span class="tok-trailing-space">' + esc(trail) + '</span>';
  }

  // Step 2: Check for error lines
  const trimmed = content.trim();
  const isIsolatedBracket = /^\[.*\]$/.test(trimmed);
  const isIsolatedSeparator = /^-{4,}$/.test(trimmed);

  let contentHtml: string;

  if (!isIsolatedBracket && !isIsolatedSeparator) {
    const hasBracket = trimmed.includes('[') && trimmed.includes(']');
    const hasSeparator = trimmed.includes('----');

    if (hasBracket || hasSeparator) {
      contentHtml = '<span class="tok-error">' + esc(content) + '</span>';
    } else {
      contentHtml = renderTokenized(content);
    }
  } else {
    contentHtml = renderTokenized(content);
  }

  // Step 3: Append trailing space highlight
  if (trail) {
    return contentHtml + '<span class="tok-trailing-space">' + esc(trail) + '</span>';
  }
  return contentHtml;
}

function renderTokenized(content: string): string {
  const parts = tokenizeLine(content);
  return parts.map(p => {
    if (p.token) {
      const t = p.token;
      if (t.parts) {
        const delim = t.value[0];
        const delimEnd = t.value[t.value.length - 1];
        const suffix = t.suffix ? '<span class="tok-suffix">' + t.suffix + '</span>' : '';
        return '<span class="' + t.cssClass + '">' + esc(delim) +
          renderParts(t.parts) +
          esc(delimEnd) + suffix + '</span>';
      }
      return '<span class="' + t.cssClass + '">' + esc(t.value) + '</span>';
    }
    return esc(p.text);
  }).join('');
}

export function renderContentHtml(text: string): string {
  const html = text.split('\n').map(renderLineHtml).join('\n');
  // Highlight trailing newline(s) at the end of the entire text
  if (text.endsWith('\n')) {
    return html + '<span class="tok-trailing-newline">\n</span>';
  }
  return html;
}
