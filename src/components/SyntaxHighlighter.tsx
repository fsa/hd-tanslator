import { useMemo } from 'react';
import { renderContentHtml } from '../lib/tokenizer';

interface SyntaxHighlighterProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SyntaxHighlighter({ content, className, style }: SyntaxHighlighterProps) {
  const lines = content.split('\n');

  const { gutterHtml, bodyHtml } = useMemo(() => {
    let g = '';
    let b = '';
    for (let i = 0; i < lines.length; i++) {
      g += '<div>' + (i + 1) + '</div>';
      b += '<div class="diff-line">' + renderContentHtml(lines[i]) + '</div>';
    }
    return { gutterHtml: g, bodyHtml: b };
  }, [content]);

  return (
    <div className={className} style={{ display: 'flex', ...style }}>
      <div className="diff-gutter" dangerouslySetInnerHTML={{ __html: gutterHtml }} />
      <div style={{ flex: 1, minWidth: 0 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </div>
  );
}
