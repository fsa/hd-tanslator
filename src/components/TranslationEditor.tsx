import { useRef, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { checkSpelling, hasSpellCheck } from '../lib/spellcheck';

interface TranslationEditorProps {
  value: string;
  original: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

function defineGameScriptLanguage(monaco: any) {
  // Check if already registered
  if (monaco.languages.getLanguages().some((l: any) => l.id === 'gamescript')) {
    return;
  }

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

/** Find double/multi-spaces and trailing spaces, return Monaco markers */
function computeWhitespaceMarkers(text: string, monaco: any): any[] {
  const markers: any[] = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // Trailing spaces
    const trailMatch = / +$/.exec(line);
    if (trailMatch && trailMatch.index > 0) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Trailing whitespace',
        startLineNumber: lineNumber,
        startColumn: trailMatch.index + 1,
        endLineNumber: lineNumber,
        endColumn: line.length + 1,
        source: 'whitespace',
      });
    }

    // Double/multi spaces (not at start of line, not trailing)
    const doubleRe = /  +/g;
    let m: RegExpExecArray | null;
    while ((m = doubleRe.exec(line)) !== null) {
      // Skip if at start of line (indentation) or if this is trailing whitespace
      if (m.index === 0) continue;
      if (m.index + m[0].length >= line.length) continue;
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Double space',
        startLineNumber: lineNumber,
        startColumn: m.index + 1,
        endLineNumber: lineNumber,
        endColumn: m.index + m[0].length + 1,
        source: 'whitespace',
      });
    }
  }

  return markers;
}

// Spell check using nspell dictionary
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

export default function TranslationEditor({ value, original, onChange, className, style }: TranslationEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    defineGameScriptLanguage(monaco);
    monaco.editor.setTheme('gamescript-theme');

    // Store reference to the modified editor (right side of diff)
    const modifiedEditor = editor.getModifiedEditor();
    editorRef.current = modifiedEditor;

    // Trigger initial markers on the modified editor
    const model = modifiedEditor.getModel();
    if (model) {
      const whitespaceMarkers = computeWhitespaceMarkers(modifiedEditor.getValue(), monaco);
      spellCheckMarkers(model, monaco, modifiedEditor.getValue()).then(spellMarkers => {
        monaco.editor.setModelMarkers(model, 'whitespace', whitespaceMarkers);
        monaco.editor.setModelMarkers(model, 'spellcheck', spellMarkers);
      });
    }

    // Listen for content changes to propagate to parent
    modifiedEditor.onDidChangeModelContent(() => {
      const newValue = modifiedEditor.getValue();
      onChange(newValue);
    });
  };

  // Update markers when value changes
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    const whitespaceMarkers = computeWhitespaceMarkers(value, monaco);
    monaco.editor.setModelMarkers(model, 'whitespace', whitespaceMarkers);

    spellCheckMarkers(model, monaco, value).then(spellMarkers => {
      monaco.editor.setModelMarkers(model, 'spellcheck', spellMarkers);
    });
  }, [value]);

  return (
    <div className={className} style={{ ...style }}>
      <DiffEditor
        original={original}
        modified={value}
        language="gamescript"
        onMount={handleEditorMount}
        options={{
          wordWrap: 'on',
          fontSize: 14,
          fontFamily: 'monospace',
          lineHeight: 21,
          padding: { top: 10 },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          unicodeHighlight: { nonBasicASCII: false, ambiguousCharacters: false },
          renderSideBySide: false,
          readOnly: false,
          originalEditable: false,
          enableSplitViewResizing: false,
          diffAlgorithm: 'advanced',
          renderMarginRevertIcon: false,
          hideUnchangedRegions: {
            enabled: false,
          },
          minimap: { enabled: false },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
          // VS Code-style diff colours
          renderOverviewRuler: true,
          overviewRulerBorder: true,
          originalEditor: {
            lineNumbers: 'off',
            lineNumbersMinChars: 1,
            glyphMargin: false,
            folding: false,
          },
          modifiedEditor: {
            lineNumbers: 'on',
            lineNumbersMinChars: 2,
            glyphMargin: false,
            folding: false,
          },
        } as any}
      />
    </div>
  );
}