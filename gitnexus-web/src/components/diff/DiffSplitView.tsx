import { useRef, useCallback, useMemo } from 'react';
import type { DiffHunk } from '../../types/diff';
import { pairHunkLines, computeWordDiff, CHANGE_CATEGORY_COLORS, type PairedLine, type DiffSegment } from '../../lib/diff-utils';

interface DiffSplitViewProps {
  hunks: DiffHunk[];
  language: string;
  hideFormatting: boolean;
  searchTerm: string;
}

export const DiffSplitView = ({ hunks, language, hideFormatting, searchTerm }: DiffSplitViewProps) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const handleLeftScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (leftRef.current && rightRef.current) {
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  // Build all rows for both sides
  const rows = useMemo(() => {
    const allRows: PairedLine[] = [];
    for (const hunk of hunks) {
      let lines = pairHunkLines(hunk);
      if (hideFormatting) {
        lines = lines.filter(l => l.type !== 'paired' || l.category !== 'formatting');
      }
      // Add hunk separator
      allRows.push({ type: 'context', oldLine: `@@ -${hunk.oldStart} +${hunk.newStart} @@`, newLine: `@@ -${hunk.oldStart} +${hunk.newStart} @@`, oldNum: undefined, newNum: undefined });
      allRows.push(...lines);
    }
    return allRows;
  }, [hunks, hideFormatting]);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: old code */}
      <div ref={leftRef} onScroll={handleLeftScroll} className="flex-1 overflow-auto scrollbar-thin border-r border-border-subtle">
        <table className="w-full border-collapse text-xs font-mono">
          <tbody>
            {rows.map((row, idx) => (
              <SplitRow key={idx} line={row} side="old" searchTerm={searchTerm} />
            ))}
          </tbody>
        </table>
      </div>
      {/* Right: new code */}
      <div ref={rightRef} onScroll={handleRightScroll} className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs font-mono">
          <tbody>
            {rows.map((row, idx) => (
              <SplitRow key={idx} line={row} side="new" searchTerm={searchTerm} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SplitRow = ({ line, side, searchTerm }: { line: PairedLine; side: 'old' | 'new'; searchTerm: string }) => {
  const wordDiff = useMemo(() => {
    if (line.type === 'paired' && line.oldLine !== undefined && line.newLine !== undefined) {
      return computeWordDiff(line.oldLine, line.newLine);
    }
    return null;
  }, [line]);

  const isOld = side === 'old';
  const lineNum = isOld ? line.oldNum : line.newNum;
  const content = isOld ? line.oldLine : line.newLine;

  if (line.type === 'context') {
    return (
      <tr>
        <td className="w-10 px-2 text-right select-none text-text-muted/40 border-r border-border-subtle/30">{lineNum ?? ''}</td>
        <td className="px-2 whitespace-pre text-text-secondary">{content || '\u00A0'}</td>
      </tr>
    );
  }

  if (line.type === 'paired') {
    const cat = line.category || 'logic';
    const colors = CHANGE_CATEGORY_COLORS[cat];
    const segments = wordDiff ? (isOld ? wordDiff.oldSegments : wordDiff.newSegments) : null;
    const bgClass = isOld ? 'bg-red-900/15' : 'bg-green-900/15';
    const textClass = isOld ? 'text-red-300' : 'text-green-300';
    const gutterClass = isOld ? 'text-red-500/60' : 'text-green-500/60';

    return (
      <tr className={`${bgClass} border-l-2 ${colors.border}`}>
        <td className={`w-10 px-2 text-right select-none ${gutterClass} border-r border-border-subtle/30`}>{lineNum ?? ''}</td>
        <td className={`px-2 whitespace-pre ${textClass}`}>
          {segments ? (
            segments.map((seg, i) => {
              if (seg.type === 'unchanged') return <span key={i}>{seg.text}</span>;
              const markClass = isOld ? 'bg-red-500/30 rounded-sm px-0.5' : 'bg-green-500/30 rounded-sm px-0.5';
              return <mark key={i} className={markClass}>{seg.text}</mark>;
            })
          ) : (
            content || '\u00A0'
          )}
        </td>
      </tr>
    );
  }

  if (line.type === 'removed') {
    if (isOld) {
      return (
        <tr className="bg-red-900/20">
          <td className="w-10 px-2 text-right select-none text-red-500/60 border-r border-border-subtle/30">{line.oldNum ?? ''}</td>
          <td className="px-2 whitespace-pre text-red-300">{line.oldLine || '\u00A0'}</td>
        </tr>
      );
    }
    // Right side: empty placeholder
    return (
      <tr className="bg-surface/20">
        <td className="w-10 px-2 text-right select-none text-text-muted/20 border-r border-border-subtle/30" />
        <td className="px-2">&nbsp;</td>
      </tr>
    );
  }

  if (line.type === 'added') {
    if (!isOld) {
      return (
        <tr className="bg-green-900/20">
          <td className="w-10 px-2 text-right select-none text-green-500/60 border-r border-border-subtle/30">{line.newNum ?? ''}</td>
          <td className="px-2 whitespace-pre text-green-300">{line.newLine || '\u00A0'}</td>
        </tr>
      );
    }
    // Left side: empty placeholder
    return (
      <tr className="bg-surface/20">
        <td className="w-10 px-2 text-right select-none text-text-muted/20 border-r border-border-subtle/30" />
        <td className="px-2">&nbsp;</td>
      </tr>
    );
  }

  return null;
};
