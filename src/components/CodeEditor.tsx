import EditorModule from 'react-simple-code-editor';
const Editor = (EditorModule as any).default || EditorModule;
import Prism from 'prismjs';
import '../lib/prism-grammar';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CodeEditor({ value, onChange, placeholder, className, style }: CodeEditorProps) {
  return (
    <Editor
      value={value}
      onValueChange={onChange}
      highlight={(code) => Prism.highlight(code, Prism.languages.gamescript, 'gamescript')}
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
