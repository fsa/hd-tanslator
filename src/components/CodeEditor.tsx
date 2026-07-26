import { useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Per-character hash-based colour palette
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
// Emotion → emoji mapping
// ---------------------------------------------------------------------------

const EMOTION_EMOJI: Record<string, string> = {
  smile: '😊', laugh: '😄', angry: '😠', sad: '😢', cry: '😭',
  love: '😍', kiss: '😘', blush: '😳', wink: '😉', surprised: '😲',
  scared: '😨', thinking: '🤔', confused: '😕', tired: '😴',
  excited: '🤩', smirk: '😏', serious: '😐', nervous: '😰',
  happy: '😃', mad: '😤', hurt: '😖', annoyed: '😒', drunk: '🥴',
  aroused: '😏', shy: '☺️', disgusted: '🤢',
  neutral: '😐', grin: '😁', gasp: '😮', frown: '☹️', pout: '😤',
};

// ---------------------------------------------------------------------------
// Gamescript language definition (Monarch tokenizer)
// ---------------------------------------------------------------------------

function defineGameScriptLanguage(monaco: any) {
  if (monaco.languages.getLanguages().some((l: any) => l.id === 'gamescript')) {
    return;
  }

  monaco.languages.register({ id: 'gamescript' });

  // Split bracket/curly labels into sub-tokens so each part gets its own
  // token type and can be coloured independently via the theme.
  monaco.languages.setMonarchTokensProvider('gamescript', {
    tokenizer: {
      root: [
        [/----/, 'separator'],

        // [NAME] or [NAME_emotion]
        [/\[/, 'bracket-delim'],
        [/([A-Za-z0-9]+)(_)([A-Za-z0-9]+)(\])/,
          ['bracket-name', 'bracket-underscore', 'bracket-emotion', 'bracket-delim']],
        [/([A-Za-z0-9]+)(\])/,
          ['bracket-name', 'bracket-delim']],

        // {NAME} or {NAME_suffix}
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

  // Theme — bracket-name and curly-name have NO foreground set so that
  // editor decorations (deltaDecorations with inlineClassName) can
  // override the colour. Only the delimiters ([, ], {, }) keep their
  // fixed colours via bracket-delim / curly-delim.
  monaco.editor.defineTheme('gamescript-theme', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'separator', foreground: '6c757d', fontStyle: 'bold' },
      { token: 'bracket-delim', foreground: '0d6efd', fontStyle: 'bold' },
      // bracket-name intentionally has no foreground — decorations supply it
      { token: 'bracket-name', fontStyle: 'bold' },
      { token: 'bracket-underscore', foreground: '6c757d' },
      { token: 'bracket-emotion', foreground: '6c757d' },
      { token: 'curly-delim', foreground: 'fd7e14', fontStyle: 'bold' },
      // curly-name intentionally has no foreground — decorations supply it
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
// Editor decorations — apply per-character hash colours to [NAME] and {NAME}
//
// We use Monaco's deltaDecorations API with inlineClassName.
// CSS classes .tok-name-0 through .tok-name-29 are defined in tokens.css
// and map to the 30 palette colours.
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

    // Match [NAME] and [NAME_emotion]
    const bracketRe = /\[([A-Za-z0-9]+)(?:_([A-Za-z0-9]+))?\]/g;
    let m: RegExpExecArray | null;
    while ((m = bracketRe.exec(line)) !== null) {
      const name = m[1];
      const colorIndex = hashColorIndex(name);
      // Name starts after '[' (1 char), Monaco columns are 1-based
      spans.push({
        line: lineNumber,
        startCol: m.index + 2,
        endCol: m.index + 2 + name.length,
        colorIndex,
      });
    }

    // Match {NAME} and {NAME_suffix}
    const curlyRe = /\{([A-Za-z0-9]+)(?:_([A-Za-z0-9]+))?\}/g;
    while ((m = curlyRe.exec(line)) !== null) {
      const name = m[1];
      const colorIndex = hashColorIndex(name);
      spans.push({
        line: lineNumber,
        startCol: m.index + 2,
        endCol: m.index + 2 + name.length,
        colorIndex,
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
      stickiness: 1, // NeverGrowsWhenTypingAtEdges
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
// Component
// ---------------------------------------------------------------------------

export default function CodeEditor({ value, onChange, placeholder, className, style, readOnly }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    defineGameScriptLanguage(monaco);
    monaco.editor.setTheme('gamescript-theme');

    // Apply per-character name colours via decorations
    updateNameDecorations(editor, value);

    // Set initial whitespace markers
    const model = editor.getModel();
    if (model) {
      const markers = computeWhitespaceMarkers(value, monaco);
      monaco.editor.setModelMarkers(model, 'whitespace', markers);
    }
  }, []);

  // Update decorations and markers when value changes
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const monaco = (window as any).monaco;
    if (!monaco) return;

    updateNameDecorations(editor, value);

    const markers = computeWhitespaceMarkers(value, monaco);
    monaco.editor.setModelMarkers(model, 'whitespace', markers);
  }, [value]);

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
          lineNumbersMinChars: 2,
        }}
        theme="gamescript-theme"
      />
    </div>
  );
}
