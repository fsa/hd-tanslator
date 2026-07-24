import { renderContentHtml } from '../lib/tokenizer';

interface SyntaxHighlighterProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SyntaxHighlighter({ content, className, style }: SyntaxHighlighterProps) {
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: renderContentHtml(content) }}
    />
  );
}
