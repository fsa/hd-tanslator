import { useRef } from 'react';
import { renderContentHtml } from '../lib/tokenizer';

interface EditableHighlighterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function EditableHighlighter({ value, onChange, className, style }: EditableHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const html = renderContentHtml(value);

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
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
  );
}
