import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { diffLines, diffChars } from 'diff';
import { tokenizeLine } from '../lib/tokenizer';

interface EditableHighlighterProps {
  value: string;
  original?: string;
  onChange: (value: string) => void;
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

function renderDiffLine(origLine: string, curLine: string): string {
  const diffs = diffChars(origLine, curLine);
  let result = '';
  for (const part of diffs) {
    if (part.added) {
      result += '<span class="diff-char-added">' + esc(part.value) + '</span>';
    } else if (!part.removed) {
      // Unchanged — escape only, no whitespace error checks
      // (whitespace is checked on the full line in renderLineHtml)
      result += esc(part.value);
    }
  }
  return result || ' ';
}

/**
 * Compute line-level diff and build a map: current line index -> original line text.
 */
function computeDiffMaps(original: string | undefined, current: string) {
  const curLines = current.split('\n');
  const origForLine: (string | undefined)[] = new Array(curLines.length);
  const changed = new Set<number>();

  if (original === undefined) {
    return { origForLine, changed };
  }

  const lineChanges = diffLines(original, current);
  let curIdx = 0;

  // Build list of removed lines to pair with added lines
  const removedLines: string[] = [];

  for (const lc of lineChanges) {
    const lcLines = lc.value.split('\n');
    if (lcLines[lcLines.length - 1] === '') lcLines.pop();

    if (lc.removed) {
      removedLines.push(...lcLines);
    }
  }

  // Now pair added lines with removed lines
  curIdx = 0;
  let removedIdx = 0;

  for (const lc of lineChanges) {
    const lcLines = lc.value.split('\n');
    if (lcLines[lcLines.length - 1] === '') lcLines.pop();

    if (lc.added) {
      for (const line of lcLines) {
        if (curIdx < curLines.length) {
          changed.add(curIdx);
          origForLine[curIdx] = removedIdx < removedLines.length ? removedLines[removedIdx] : undefined;
          removedIdx++;
        }
        curIdx++;
      }
    } else if (!lc.removed) {
      curIdx += lcLines.length;
    }
  }

  return { origForLine, changed };
}

interface PopoverState {
  lineIdx: number;
  origText: string;
  x: number;
  y: number;
}

export default function EditableHighlighter({ value, original, onChange, className, style }: EditableHighlighterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const curLines = value.split('\n');

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  const { html, changedSet, origForLine } = useMemo(() => {
    const { origForLine, changed } = computeDiffMaps(original, value);
    const result: string[] = [];

    for (let i = 0; i < curLines.length; i++) {
      if (changed.has(i) && origForLine[i] !== undefined) {
        // Changed line — render with character-level diff
        result.push(renderDiffLine(origForLine[i]!, curLines[i]));
      } else {
        result.push(renderTokenizedLine(curLines[i]));
      }
    }

    return { html: result, changedSet: changed, origForLine };
  }, [value, original]);

  const handleLineHover = useCallback((lineIdx: number, e: React.MouseEvent) => {
    if (!changedSet.has(lineIdx)) {
      setPopover(null);
      return;
    }
    const orig = origForLine[lineIdx];
    if (orig === undefined) {
      setPopover(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      lineIdx,
      origText: orig,
      x: rect.right + 8,
      y: rect.top,
    });
  }, [changedSet, origForLine]);

  const handleLineLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setPopover(null), 200);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    setPopover(null);
  }, []);

  const gutterHtml = useMemo(() => {
    return curLines.map((_, i) => {
      if (changedSet.has(i)) {
        return '<div class="gutter-added">' + (i + 1) + ' <span class="gutter-marker">+</span></div>';
      }
      return '<div>' + (i + 1) + '</div>';
    }).join('');
  }, [curLines, changedSet]);

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current && gutterRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className={className} style={{ display: 'flex', position: 'relative', ...style }}>
      <div
        ref={gutterRef}
        className="diff-gutter"
        dangerouslySetInnerHTML={{ __html: gutterHtml }}
        onMouseLeave={handleLineLeave}
        onMouseOver={(e) => {
          const target = e.target as HTMLElement;
          const div = target.closest('.gutter-added');
          if (!div) { setPopover(null); return; }
          const idx = Array.from(div.parentElement!.children).indexOf(div);
          if (idx >= 0) handleLineHover(idx, e);
        }}
      />
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <div
          ref={highlightRef}
          className="highlight-layer"
          dangerouslySetInnerHTML={{ __html: html.join('\n') }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          className="editor-textarea"
        />
      </div>
      {popover && (
        <div
          className="diff-popover"
          style={{ position: 'fixed', left: popover.x, top: popover.y, zIndex: 1000 }}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        >
          <div className="diff-popover-label">Original:</div>
          <pre className="diff-popover-text">{popover.origText}</pre>
        </div>
      )}
    </div>
  );
}
