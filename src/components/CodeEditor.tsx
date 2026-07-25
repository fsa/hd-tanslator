import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { checkSpelling, hasSpellCheck } from '../lib/spellcheck';

interface CodeEditorProps {
  value: string;
  original?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

const PALETTE = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#c0392b', '#7f8c8d', '#2c3e50',
  '#e91e63', '#00bcd4', '#ff5722', '#607d8b', '#795548',
  '#4caf50', '#ff9800', '#673ab7', '#03a9f4', '#8bc34a',
  '#ffc107', '#009688', '#f44336', '#2196f3', '#689f38',
];

function aggressiveHash(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  }
  return (4294967296 + (h2 >>> 0)) % PALETTE.length;
}

function hashColor(name: string): string {
  return PALETTE[aggressiveHash(name)];
}

function defineGameScriptLanguage(monaco: any) {
  monaco.languages.register({ id: 'gamescript' });

  monaco.languages.setMonarchTokensProvider('gamescript', {
    tokenizer: {
      root: [
        [/\-{4,}/, 'separator'],
        [/\[[A-Za-z0-9_]*\]/, 'bracket-label'],
        [/\{[^}]*\}/, 'curly-tag'],
        [/<[A-Za-z\/][A-Za-z0-9_ ]*[^>]*>/, 'angle-tag'],
        [/\u2014/, 'invalid-char'],
        [/  +/, 'double-space'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration('gamescript', {
    comments: { lineComment: '//' },
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '<', close: '>' },
    ],
  });

  monaco.editor.defineTheme('gamescript-theme', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'separator', foreground: '6c757d', fontStyle: 'bold' },
      { token: 'bracket-label', foreground: '0d6efd', fontStyle: 'bold' },
      { token: 'curly-tag', foreground: 'fd7e14', fontStyle: 'bold' },
      { token: 'angle-tag', foreground: 'dc3545', fontStyle: 'bold' },
      { token: 'double-space', background: 'dc3545', fontStyle: 'bold' },
      { token: 'invalid-char', background: 'dc3545', fontStyle: 'bold' },
    ],
    colors: {},
  });
}

// Spell check using nspell dictionary — only if dictionaries are available
async function spellCheckMarkers(model: any, monaco: any, text: string): Promise<any[]> {
  const available = await hasSpellCheck();
  if (!available) return [];
  const results = await checkSpelling(text);
  return results.map(r => ({
    severity: monaco.MarkerSeverity.Warning,
    message: `Possible typo: "${r.word}"`,
    startLineNumber: r.line,
    startColumn: r.column,
    endLineNumber: r.line,
    endColumn: r.column + r.length,
    source: 'spellcheck',
  }));
}

export default function CodeEditor({ value, original, onChange, placeholder, className, style, readOnly }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    defineGameScriptLanguage(monaco);
    monaco.editor.setTheme('gamescript-theme');

    // Trigger initial spell check
    const model = editor.getModel();
    if (model && !readOnly) {
      spellCheckMarkers(model, monaco, editor.getValue()).then(markers => {
        monaco.editor.setModelMarkers(model, 'spellcheck', markers);
      });
    }
  };

  // Apply diff decorations + whitespace markers + spell check when content changes
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    const decorations: any[] = [];

    // Diff decorations
    if (original) {
      const origLines = original.split('\n');
      const curLines = value.split('\n');
      const maxLen = Math.max(origLines.length, curLines.length);

      for (let i = 0; i < maxLen; i++) {
        const origLine = i < origLines.length ? origLines[i] : undefined;
        const curLine = i < curLines.length ? curLines[i] : '';

        if (origLine !== undefined && curLine !== origLine) {
          decorations.push({
            range: new monaco.Range(i + 1, 1, i + 1, model.getLineMaxColumn(i + 1)),
            options: { isWholeLine: true, className: 'diff-line-added' },
          });
        }
      }
    }

    // Whitespace markers
    const curLines = value.split('\n');
    for (let i = 0; i < curLines.length; i++) {
      const line = curLines[i];
      const lineNum = i + 1;

      const doubleSpaceRe = /  +/g;
      let m;
      while ((m = doubleSpaceRe.exec(line)) !== null) {
        decorations.push({
          range: new monaco.Range(lineNum, m.index + 1, lineNum, m.index + m[0].length + 1),
          options: { inlineClassName: 'monaco-double-space' },
        });
      }

      const trailMatch = / +$/.exec(line);
      if (trailMatch) {
        decorations.push({
          range: new monaco.Range(lineNum, trailMatch.index! + 1, lineNum, line.length + 1),
          options: { inlineClassName: 'monaco-trailing-space' },
        });
      }
    }

    editor.deltaDecorations([], decorations);

    // Spell check markers
    if (!readOnly) {
      spellCheckMarkers(model, monaco, value).then(spellMarkers => {
        monaco.editor.setModelMarkers(model, 'spellcheck', spellMarkers);
      });
    }
  }, [value, original, readOnly]);

  return (
    <div className={className} style={{ ...style }}>
      <Editor
        height="100%"
        language="gamescript"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorMount}
        options={{
          readOnly: readOnly || false,
          wordWrap: 'on',
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: 'monospace',
          lineHeight: 21,
          padding: { top: 10 },
          automaticLayout: true,
          unicodeHighlight: { nonBasicASCII: false, ambiguousCharacters: false },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
        }}
        theme="gamescript-theme"
      />
    </div>
  );
}
