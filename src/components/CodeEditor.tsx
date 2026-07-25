import EditorModule from 'react-simple-code-editor';
import { highlightCode } from '../lib/prism-grammar';

const SimpleEditor = (EditorModule as any).default || EditorModule;

interface CodeEditorProps {
  value: string;
  original?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CodeEditor({ value, original, onChange, placeholder, className, style }: CodeEditorProps) {
  return (
    <SimpleEditor
      value={value}
      onValueChange={onChange}
      highlight={(code) => highlightCode(code, original)}
      padding={10}
      placeholder={placeholder}
      className={className}
      style={{
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.5',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        minHeight: '200px',
        ...style,
      }}
    />
  );
}
