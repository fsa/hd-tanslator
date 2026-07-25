import { useRef, useMemo } from 'react';
import { diffLines, diffChars } from 'diff';
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

function computeChangedLines(original: string | undefined, current: string): Set<number> {
  const changed = new Set<number>();
  if (original === undefined) return changed;
  const origSet = new Set(original.split('\n'));
  const curLines = current.split('\n');
  for (let i = 0; i < curLines.length; i++) {
    if (!origSet.has(curLines[i])) changed.add(i);
  }
  return changed;
}

export default function EditableHighlighter({ value, original, onChange, className, style }: EditableHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const curLines = value.split('\n');
  const changedSet = useMemo(() => computeChangedLines(original, value), [value, original]);

  const html = useMemo(() => {
    return curLines.map((line, i) => {
      const rendered = renderTokenizedLine(line);
      if (changedSet.has(i)) {
        return '<span class="diff-line-added">' + rendered + '</span>';
      }
      return rendered;
    }).join('\n');
  }, [value, changedSet]);

  const handleScroll = () => {
    if (textareaRef.current) {
      const prev = textareaRef.current.previousElementSibling;
      if (prev instanceof HTMLElement) {
        prev.scrollTop = textareaRef.current.scrollTop;
        prev.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  };

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div
        className="eh-backdrop"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className="eh-input"
      />
    </div>
  );
}
