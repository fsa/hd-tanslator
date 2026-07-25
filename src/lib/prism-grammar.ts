import Prism from 'prismjs';
import { diffChars } from 'diff';

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

function hashColor(name: string): string {
  return PALETTE[aggressiveHash(name)];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Grammar WITHOUT trailing-space — Prism only handles syntax tokens
Prism.languages.gamescript = {
  'separator': { pattern: /^-{4,}$/m, alias: 'tok-separator' },
  'bracket-label': { pattern: /\[[A-Za-z0-9_]*\]/ },
  'curly-tag': { pattern: /\{[^}]*\}/ },
  'angle-tag': { pattern: /<[A-Za-z\/][A-Za-z0-9_ ]*[^>]*>/, alias: 'tok-angle' },
  'double-space': { pattern: /  +/, alias: 'tok-double-space' },
  'invalid-char': { pattern: /\u2014/, alias: 'tok-invalid' },
};

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

function highlightBracket(token: string): string {
  const inner = token.slice(1, -1);
  const parts = inner.split('_');
  const name = parts[0];
  const nameColor = hashColor(name);

  if (parts.length === 1) {
    return '<span style="color:#0d6efd;font-weight:bold">[</span>' +
      '<span style="color:' + nameColor + ';font-weight:bold">' + esc(name) + '</span>' +
      '<span style="color:#0d6efd;font-weight:bold">]</span>';
  }

  const emotion = parts.slice(1).join('_');
  const emotionColor = hashColor(emotion);
  const emoji = emotionEmoji(emotion);
  return '<span style="color:#0d6efd;font-weight:bold">[</span>' +
    '<span style="color:' + nameColor + ';font-weight:bold">' + esc(name) + '</span>' +
    '<span style="color:#6c757d">' + esc('_') + '</span>' +
    '<span style="color:' + emotionColor + '">' + esc(emotion) + '</span>' +
    '<span style="color:#0d6efd;font-weight:bold">]</span>' +
    '<span style="font-size:0.9em">' + emoji + '</span>';
}

function highlightCurly(token: string): string {
  const inner = token.slice(1, -1);
  const parts = inner.split('_');
  const name = parts[0];
  const color = hashColor(name);

  if (parts.length === 1) {
    return '<span style="color:#fd7e14;font-weight:bold">{</span>' +
      '<span style="color:' + color + ';font-weight:bold">' + esc(name) + '</span>' +
      '<span style="color:#fd7e14;font-weight:bold">}</span>';
  }

  const suffix = parts.slice(1).join('_');
  return '<span style="color:#fd7e14;font-weight:bold">{</span>' +
    '<span style="color:' + color + ';font-weight:bold">' + esc(name) + '</span>' +
    '<span style="color:#6c757d">' + esc('_') + '</span>' +
    '<span style="color:#888">' + esc(suffix) + '</span>' +
    '<span style="color:#fd7e14;font-weight:bold">}</span>';
}

function prismHighlight(text: string): string {
  if (!text) return '';
  return Prism.highlight(text, Prism.languages.gamescript, 'gamescript');
}

/**
 * Highlight a single line: brackets, curly, Prism syntax, then trailing-space.
 */
function highlightLineSyntax(line: string): string {
  if (!line) return ' ';

  const placeholders: string[] = [];
  let processed = line;

  processed = processed.replace(/\[[A-Za-z0-9_]*\]/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(highlightBracket(match));
    return '\x00' + idx + '\x00';
  });

  processed = processed.replace(/\{[^}]*\}/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(highlightCurly(match));
    return '\x00' + idx + '\x00';
  });

  let highlighted = prismHighlight(processed);

  for (let i = 0; i < placeholders.length; i++) {
    highlighted = highlighted.replace('\x00' + i + '\x00', placeholders[i]);
  }

  // Prism handles syntax only — trailing-space is not needed in editor

  return highlighted;
}

export function highlightCode(code: string, original?: string): string {
  if (!original || original === code) {
    const lines = code.split('\n');
    return lines.map(line => highlightLineSyntax(line)).join('\n');
  }

  const origLines = original.split('\n');
  const curLines = code.split('\n');
  const maxLen = Math.max(origLines.length, curLines.length);
  const result: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const origLine = i < origLines.length ? origLines[i] : undefined;
    const curLine = i < curLines.length ? curLines[i] : '';

    if (origLine === undefined) {
      result.push('<span class="diff-line-added">' + highlightLineSyntax(curLine) + '</span>');
    } else if (curLine === origLine) {
      result.push(highlightLineSyntax(curLine));
    } else {
      result.push(highlightDiffLine(origLine, curLine));
    }
  }

  return result.join('\n');
}

function highlightDiffLine(origLine: string, curLine: string): string {
  const diffs = diffChars(origLine, curLine);
  let result = '';
  for (const part of diffs) {
    if (part.added) {
      result += '<span class="diff-char-added">' + esc(part.value) + '</span>';
    } else if (!part.removed) {
      result += highlightLineSyntax(part.value);
    }
  }
  return result || ' ';
}

export { hashColor };
