import { useRef, useMemo } from 'react';
import { diffLines } from 'diff';
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

export default function EditableHighlighter({ value, original, onChange, className, style }: EditableHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const curLines = value.split('\n');

  const { html, changedSet } = useMemo(() => {
    if (original === undefined) {
      return {
        html: curLines.map(l => renderTokenizedLine(l)),
        changedSet: new Set<number>()
      };
    }

    const lineChanges = diffLines(original, value);
    const result: string[] = new Array(curLines.length);
    const changed = new Set<number>();
    let curIdx = 0;

    for (const lc of lineChanges) {
      const lcLines = lc.value.split('\n');
      if (lcLines[lcLines.length - 1] === '') lcLines.pop();

      if (lc.added) {
        for (const line of lcLines) {
          if (curIdx < result.length) {
            changed.add(curIdx);
            result[curIdx] = renderTokenizedLine(line);
          }
          curIdx++;
        }
      } else if (!lc.removed) {
        for (const line of lcLines) {
          if (curIdx < result.length) {
            result[curIdx] = renderTokenizedLine(line);
          }
          curIdx++;
        }
      }
    }

    // Fill any remaining slots
    while (curIdx < result.length) {
      result[curIdx] = renderTokenizedLine(curLines[curIdx]);
      curIdx++;
    }

    return { html: result, changedSet: changed };
  }, [value, original]);

  const gutterHtml = useMemo(() => {
    return curLines.map((_, i) => {
      if (changedSet.has(i)) {
        return '<div class="gutter-added">' + (i + 1) + ' <span class="gutter-marker">+</span></div>';
      }
      return '<div>' + (i + 1) + '</div>';
    }).join('');
  }, [curLines, changedSet]);

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
          dangerouslySetInnerHTML={{ __html: html.join('\n') }}
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
