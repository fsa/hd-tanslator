import { useMemo } from 'react';
import { tokenizeLine } from '../lib/tokenizer';

interface TextViewerProps {
  content: string;
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

export default function TextViewer({ content, className, style }: TextViewerProps) {
  const html = useMemo(() => {
    return content.split('\n').map(line => renderTokenizedLine(line)).join('\n');
  }, [content]);

  return (
    <div
      className={className}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
