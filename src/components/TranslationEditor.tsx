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

// ---------------------------------------------------------------------------
// Per-character hash-based colour palette (shared with CodeEditor)
// ---------------------------------------------------------------------------

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

function hashColorIndex(name: string): number {
  return aggressiveHash(name);
}

// ---------------------------------------------------------------------------
// Gamescript language definition (Monarch tokenizer)
// ---------------------------------------------------------------------------

function defineGameScriptLanguage(monaco: any) {
  if (monaco.languages.getLanguages().some((l: any) => l.id === 'gamescript')) {
    return;
  }

  monaco.languages.register({ id: 'gamescript' });

  monaco.languages.setMonarchTokensProvider('gamescript', {
    tokenizer: {
      root: [
        [/----/, 'separator'],
        [/\[/, 'bracket-delim'],
        [/([A-Za-z0-9]+)(_)([A-Za-z0-9]+)(\])/,
          ['bracket-name', 'bracket-underscore', 'bracket-emotion', 'bracket-delim']],
        [/([A-Za-z0-9]+)(\])/,
          ['bracket-name', 'bracket-delim']],
        [/\{/, 'curly-delim'],
        [/([A-Za-z0-9]+)(_)([A-Za-z0-9]+)(\})/,
          ['curly-name', 'curly-underscore', 'curly-suffix', 'curly-delim']],
        [/([A-Za-z0-9]+)(\})/,
          ['curly-name', 'curly-delim']],
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
      { token: 'bracket-delim', foreground: '0d6efd', fontStyle: 'bold' },
      // bracket-name has no foreground — decorations supply per-character colour
      { token: 'bracket-name', fontStyle: 'bold' },
      { token: 'bracket-underscore', foreground: '6c757d' },
      { token: 'bracket-emotion', foreground: '6c757d' },
      { token: 'curly-delim', foreground: 'fd7e14', fontStyle: 'bold' },
      // curly-name has no foreground — decorations supply per-character colour
      { token: 'curly-name', fontStyle: 'bold' },
      { token: 'curly-underscore', foreground: '6c757d' },
      { token: 'curly-suffix', foreground: '6c757d' },
      { token: 'angle-tag', foreground: 'dc3545', fontStyle: 'bold' },
      { token: 'double-space', background: 'dc3545', fontStyle: 'bold' },
      { token: 'invalid-char', background: 'dc3545', fontStyle: 'bold' },
    ],
    colors: {},
  });
}

// ---------------------------------------------------------------------------
// Editor decorations — per-character hash colours for [NAME] and {NAME}
// ---------------------------------------------------------------------------

interface NameSpan {
  line: number;
  startCol: number;
  endCol: number;
  colorIndex: number;
}

function findNameSpans(text: string): NameSpan[] {
  const spans: NameSpan[] = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    const bracketRe = /\[([A-Za-z0-9]+)(?:_([A-Za-z0-9]+))?\]/g;
    let m: RegExpExecArray | null;
    while ((m = bracketRe.exec(line)) !== null) {
      const name = m[1];
      spans.push({
        line: lineNumber,
        startCol: m.index + 2,
        endCol: m.index + 2 + name.length,
        colorIndex: hashColorIndex(name),
      });
    }

    const curlyRe = /\{([A-Za-z0-9]+)(?:_([A-Za-z0-9]+))?\}/g;
    while ((m = curlyRe.exec(line)) !== null) {
      const name = m[1];
      spans.push({
        line: lineNumber,
        startCol: m.index + 2,
        endCol: m.index + 2 + name.length,
        colorIndex: hashColorIndex(name),
      });
    }
  }

  return spans;
}

function updateNameDecorations(editor: any, text: string) {
  if (!editor) return;

  // Retrieve previous decoration IDs so we can replace them
  const oldIds: string[] = (editor as any).__nameDecorationIds || [];

  const spans = findNameSpans(text);
  const decorations = spans.map(span => ({
    range: {
      startLineNumber: span.line,
      startColumn: span.startCol,
      endLineNumber: span.line,
      endColumn: span.endCol,
    },
    options: {
      inlineClassName: `tok-name-${span.colorIndex}`,
      inlineClassNameAffectsLetterSpacing: true,
      stickiness: 1,
    },
  }));

  const newIds = editor.deltaDecorations(oldIds, decorations);
  (editor as any).__nameDecorationIds = newIds;
}

// ---------------------------------------------------------------------------
// Whitespace markers
// ---------------------------------------------------------------------------

function computeWhitespaceMarkers(text: string, monaco: any): any[] {
  const markers: any[] = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

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

    const doubleRe = /  +/g;
    let m: RegExpExecArray | null;
    while ((m = doubleRe.exec(line)) !== null) {
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

// ---------------------------------------------------------------------------
// Spell check
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TranslationEditor({ value, original, onChange, className, style }: TranslationEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    defineGameScriptLanguage(monaco);
    monaco.editor.setTheme('gamescript-theme');

    // Store reference to the modified editor (right side of diff)
    const modifiedEditor = editor.getModifiedEditor();
    editorRef.current = modifiedEditor;

    // Apply per-character name colours
    updateNameDecorations(modifiedEditor, modifiedEditor.getValue());

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

    // Update name colour decorations
    updateNameDecorations(editor, value);

    // Update whitespace markers
    const whitespaceMarkers = computeWhitespaceMarkers(value, monaco);
    monaco.editor.setModelMarkers(model, 'whitespace', whitespaceMarkers);

    // Update spell check markers
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