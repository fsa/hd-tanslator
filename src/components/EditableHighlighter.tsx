import { useRef, useMemo } from 'react';
import { tokenizeLine } from '../lib/tokenizer';

interface EditableHighlighterProps {
  value: string;
  original?: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

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

function renderTokenizedLine(line: string): string {
  if (line.length === 0) return ' ';
  const parts = tokenizeLine(line);
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

function computeAddedLines(original: string | undefined, current: string): Set<number> {
  const added = new Set<number>();
  if (original === undefined) return added;
  const origSet = new Set(original.split('\n'));
  const curLines = current.split('\n');
  for (let i = 0; i < curLines.length; i++) {
    if (!origSet.has(curLines[i])) {
      added.add(i);
    }
  }
  return added;
}

function computeLineTypes(original: string | undefined, current: string): Map<number, 'added' | 'removed'> {
  const types = new Map<number, 'added' | 'removed'>();
  if (original === undefined) return types;

  const origLines = original.split('\n');
  const curLines = current.split('\n');
  const origSet = new Set(origLines);

  // Mark added lines (in current but not in original)
  for (let i = 0; i < curLines.length; i++) {
    if (!origSet.has(curLines[i])) {
      types.set(i, 'added');
    }
  }

  // Mark removed lines (in original but not in current) — for gutter only
  const curSet = new Set(curLines);
  let removedCount = 0;
  for (let i = 0; i < origLines.length; i++) {
    if (!curSet.has(origLines[i])) {
      // This line was removed — we track it for gutter display
      // The gutter needs to show the original line number with a marker
      types.set(-(i + 1), 'removed'); // negative key = removed line
    }
  }

  return types;
}

export default function EditableHighlighter({ value, original, onChange, className, style }: EditableHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const curLines = value.split('\n');
  const addedSet = useMemo(() => computeAddedLines(original, value), [value, original]);
  const lineTypes = useMemo(() => computeLineTypes(original, value), [value, original]);

  // Build highlight HTML as plain text with spans — no divs, no extra whitespace
  const html = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < curLines.length; i++) {
      const rendered = renderTokenizedLine(curLines[i]);
      if (addedSet.has(i)) {
        lines.push('<span class="diff-added">' + rendered + '</span>');
      } else {
        lines.push(rendered);
      }
    }
    return lines.join('\n');
  }, [value, addedSet]);

  // Build gutter — one div per current line + removed line markers
  const gutterHtml = useMemo(() => {
    const parts: string[] = [];
    let curIdx = 0;
    let origIdx = 0;

    // Interleave current lines with removed line markers
    const origLines = original?.split('\n') ?? [];
    const curSet = new Set(curLines);

    // Simple approach: show current line numbers, and show removed lines at their original positions
    for (let i = 0; i < curLines.length; i++) {
      if (addedSet.has(i)) {
        parts.push('<div class="gutter-added">' + (i + 1) + ' <span class="gutter-marker">+</span></div>');
      } else {
        parts.push('<div>' + (i + 1) + '</div>');
      }
    }

    return parts.join('');
  }, [curLines, addedSet]);

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current && gutterRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className={className} style={{ display: 'flex', position: 'relative', ...style }}>
      <div ref={gutterRef} className="diff-gutter" dangerouslySetInnerHTML={{ __html: gutterHtml }} />
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <div
          ref={highlightRef}
          className="highlight-layer"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          className="editor-textarea"
        />
      </div>
    </div>
  );
}
