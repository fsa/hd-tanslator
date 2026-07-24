/**
 * Tokenizer for game script syntax.
 *
 * Supported tokens (matched in order of priority):
 *   1. [NARR], [MAIN], [LETHE_*], [OPTION] — bracket labels
 *   2. <if ...>, <else>, <...>              — angle-tag constructions
 *   3. {NAME}, {PROF}, {...}               — curly-tag constructions
 *   4. ----                                  separator
 *
 * Delimiter tokens ([], <>, {}) render the brackets/delimiters in one color
 * and the inner content in another color via nested spans.
 */

export type TokenType =
  | 'separator'
  | 'bracket-label'
  | 'angle-tag'
  | 'curly-tag';

export interface Token {
  type: TokenType;
  value: string;
  /** CSS class for the outer wrapper (delimiter color). */
  cssClass: string;
  /** If set, inner text gets its own CSS class. */
  innerClass?: string;
  /** The text between delimiters (without the delimiters themselves). */
  inner?: string;
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
      best = { index: m.index, token: { type: 'bracket-label', value: m[0], cssClass: 'tok-bracket', inner: m[1], innerClass: bracketInnerClass(m[1]) } };
    }
  }

  // 3. <tag ...>
  const angleRe = /<([A-Za-z/][A-Za-z0-9_ ]*)([^>]*)>/g;
  while ((m = angleRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      const inner = m[1] + m[2];
      best = { index: m.index, token: { type: 'angle-tag', value: m[0], cssClass: 'tok-angle', inner, innerClass: 'tok-angle-inner' } };
    }
  }

  // 4. {expr}
  const curlyRe = /\{([^}]*)\}/g;
  while ((m = curlyRe.exec(text)) !== null) {
    if (!best || m.index < best.index) {
      best = { index: m.index, token: { type: 'curly-tag', value: m[0], cssClass: 'tok-curly', inner: m[1], innerClass: 'tok-curly-inner' } };
    }
  }

  return best;
}

function bracketInnerClass(label: string): string {
  const upper = label.toUpperCase();
  if (upper === 'NARR') return 'tok-bracket-inner tok-bracket-narr';
  if (upper === 'MAIN') return 'tok-bracket-inner tok-bracket-main';
  if (upper.startsWith('LETHE')) return 'tok-bracket-inner tok-bracket-lethe';
  if (upper === 'OPTION') return 'tok-bracket-inner tok-bracket-option';
  return 'tok-bracket-inner';
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
function esc(s: string): string {
  return s.replace(/[&<>]/g, c => ESC_MAP[c]);
}

export function renderLineHtml(line: string): string {
  if (line.length === 0) return '&nbsp;';
  const parts = tokenizeLine(line);
  return parts.map(p => {
    if (p.token) {
      const t = p.token;
      if (t.inner !== undefined && t.innerClass) {
        // Split into delimiter + inner + delimiter
        const delim = t.value[0];
        const delimEnd = t.value[t.value.length - 1];
        return '<span class="' + t.cssClass + '">' + esc(delim) +
          '<span class="' + t.innerClass + '">' + esc(t.inner) + '</span>' +
          esc(delimEnd) + '</span>';
      }
      return '<span class="' + t.cssClass + '">' + esc(t.value) + '</span>';
    }
    return esc(p.text);
  }).join('');
}

export function renderContentHtml(text: string): string {
  return text.split('\n').map(renderLineHtml).join('\n');
}
