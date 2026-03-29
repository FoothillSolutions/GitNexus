import { useState, useMemo, useCallback } from 'react';
import { Copy, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import type { DiffHunk, DiffSymbol } from '../../types/diff';
import {
  pairHunkLines, computeWordDiff, findCollapsibleRanges,
  classifyHunkIntent, CHANGE_CATEGORY_COLORS,
  type PairedLine, type DiffSegment,
} from '../../lib/diff-utils';

interface DiffHunkViewProps {
  hunk: DiffHunk;
  hunkIndex: number;
  language: string;
  hideFormatting: boolean;
  collapseThreshold: number;
  searchTerm: string;
  hasDirectlyChangedSymbol?: boolean;
}

export const DiffHunkView = ({
  hunk, hunkIndex, language,
  hideFormatting, collapseThreshold, searchTerm,
  hasDirectlyChangedSymbol,
}: DiffHunkViewProps) => {
  const [copied, setCopied] = useState(false);
  const [expandedRanges, setExpandedRanges] = useState<Set<number>>(new Set());
  const hunkIntent = useMemo(() => classifyHunkIntent(hunk), [hunk]);

  // Pair lines for word-level diffing
  const pairedLines = useMemo(() => {
    let lines = pairHunkLines(hunk);
    if (hideFormatting) {
      lines = lines.filter(l => l.type !== 'paired' || l.category !== 'formatting');
    }
    return lines;
  }, [hunk, hideFormatting]);

  // Find collapsible context ranges
  const collapsibleRanges = useMemo(
    () => findCollapsibleRanges(pairedLines, collapseThreshold),
    [pairedLines, collapseThreshold],
  );

  // Filter by search term
  const matchesSearch = useCallback((line: string | undefined) => {
    if (!searchTerm || !line) return true;
    return line.toLowerCase().includes(searchTerm.toLowerCase());
  }, [searchTerm]);

  const handleCopyHunk = useCallback(() => {
    navigator.clipboard.writeText(hunk.lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [hunk.lines]);

  const toggleRange = useCallback((rangeIdx: number) => {
    setExpandedRanges(prev => {
      const next = new Set(prev);
      if (next.has(rangeIdx)) next.delete(rangeIdx);
      else next.add(rangeIdx);
      return next;
    });
  }, []);

  // Build collapsed index set
  const collapsedIndices = useMemo(() => {
    const set = new Set<number>();
    collapsibleRanges.forEach((range, idx) => {
      if (!expandedRanges.has(idx)) {
        for (let i = range.startIdx; i < range.endIdx; i++) {
          set.add(i);
        }
      }
    });
    return set;
  }, [collapsibleRanges, expandedRanges]);

  return (
    <div className="border-b border-border-subtle/50" data-hunk-index={hunkIndex}>
      {/* Hunk header */}
      <div className="group px-4 py-1 bg-surface/40 text-text-muted text-[10px] border-b border-border-subtle/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasDirectlyChangedSymbol && (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          )}
          <span>@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</span>
          {hunkIntent && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[9px] font-medium">
              {hunkIntent}
            </span>
          )}
        </div>
        <button
          onClick={handleCopyHunk}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-hover transition-all"
          title="Copy hunk"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Lines */}
      <table className="w-full border-collapse">
        <tbody>
          {pairedLines.map((pl, idx) => {
            // Handle collapsed ranges
            if (collapsedIndices.has(idx)) {
              // Show collapse button at the start of the range
              const rangeIdx = collapsibleRanges.findIndex(r => r.startIdx === idx);
              if (rangeIdx >= 0) {
                const range = collapsibleRanges[rangeIdx];
                return (
                  <tr key={`collapse-${idx}`}>
                    <td colSpan={4}>
                      <button
                        onClick={() => toggleRange(rangeIdx)}
                        className="w-full py-1 px-4 text-[10px] text-text-muted bg-surface/20 hover:bg-hover transition-colors flex items-center justify-center gap-1"
                      >
                        <ChevronDown className="w-3 h-3" />
                        {range.lineCount} lines hidden
                      </button>
                    </td>
                  </tr>
                );
              }
              return null; // Hidden line
            }

            // Show "collapse" button at start of an expanded range
            const expandedRangeIdx = collapsibleRanges.findIndex(r => r.startIdx === idx && expandedRanges.has(collapsibleRanges.indexOf(r)));
            const showCollapseButton = expandedRangeIdx >= 0;

            // Search filter
            if (searchTerm && !matchesSearch(pl.oldLine) && !matchesSearch(pl.newLine)) {
              return null;
            }

            return (
              <>
                {showCollapseButton && (
                  <tr key={`recollapse-${idx}`}>
                    <td colSpan={4}>
                      <button
                        onClick={() => toggleRange(expandedRangeIdx)}
                        className="w-full py-0.5 px-4 text-[9px] text-text-muted/60 hover:bg-hover transition-colors flex items-center justify-center gap-1"
                      >
                        <ChevronDown className="w-2.5 h-2.5 rotate-180" />
                        collapse
                      </button>
                    </td>
                  </tr>
                )}
                <PairedLineRow key={idx} line={pl} searchTerm={searchTerm} />
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Render a single paired line with word-level diff and category coloring */
const PairedLineRow = ({ line, searchTerm }: { line: PairedLine; searchTerm: string }) => {
  const wordDiff = useMemo(() => {
    if (line.type === 'paired' && line.oldLine !== undefined && line.newLine !== undefined) {
      return computeWordDiff(line.oldLine, line.newLine);
    }
    return null;
  }, [line]);

  if (line.type === 'context') {
    return (
      <tr className="opacity-60">
        <td className="w-10 px-2 text-right select-none text-text-muted/40 border-r border-border-subtle/30">{line.oldNum ?? ''}</td>
        <td className="w-10 px-2 text-right select-none text-text-muted/40 border-r border-border-subtle/30">{line.newNum ?? ''}</td>
        <td className="w-6 px-1 text-center select-none text-text-muted/40" />
        <td className="px-2 whitespace-pre text-text-secondary">
          <HighlightedContent content={line.oldLine || ''} searchTerm={searchTerm} />
        </td>
      </tr>
    );
  }

  if (line.type === 'paired') {
    const cat = line.category || 'logic';
    const colors = CHANGE_CATEGORY_COLORS[cat];

    return (
      <>
        {/* Old line (removed) */}
        <tr className={`${colors.bg} border-l-2 ${colors.border}`}>
          <td className="w-10 px-2 text-right select-none text-red-500/60 border-r border-border-subtle/30">{line.oldNum ?? ''}</td>
          <td className="w-10 px-2 text-right select-none text-red-500/60 border-r border-border-subtle/30" />
          <td className="w-6 px-1 text-center select-none text-red-500/60">-</td>
          <td className="px-2 whitespace-pre text-red-300">
            {wordDiff ? (
              <WordDiffLine segments={wordDiff.oldSegments} type="removed" searchTerm={searchTerm} />
            ) : (
              <HighlightedContent content={line.oldLine || ''} searchTerm={searchTerm} />
            )}
          </td>
        </tr>
        {/* New line (added) */}
        <tr className={`${colors.bg} border-l-2 ${colors.border}`}>
          <td className="w-10 px-2 text-right select-none text-green-500/60 border-r border-border-subtle/30" />
          <td className="w-10 px-2 text-right select-none text-green-500/60 border-r border-border-subtle/30">{line.newNum ?? ''}</td>
          <td className="w-6 px-1 text-center select-none text-green-500/60">+</td>
          <td className="px-2 whitespace-pre text-green-300">
            {wordDiff ? (
              <WordDiffLine segments={wordDiff.newSegments} type="added" searchTerm={searchTerm} />
            ) : (
              <HighlightedContent content={line.newLine || ''} searchTerm={searchTerm} />
            )}
          </td>
        </tr>
      </>
    );
  }

  if (line.type === 'removed') {
    return (
      <tr className="bg-red-900/20">
        <td className="w-10 px-2 text-right select-none text-red-500/60 border-r border-border-subtle/30">{line.oldNum ?? ''}</td>
        <td className="w-10 px-2 text-right select-none text-red-500/60 border-r border-border-subtle/30" />
        <td className="w-6 px-1 text-center select-none text-red-500/60">-</td>
        <td className="px-2 whitespace-pre text-red-300">
          <HighlightedContent content={line.oldLine || ''} searchTerm={searchTerm} />
        </td>
      </tr>
    );
  }

  if (line.type === 'added') {
    return (
      <tr className="bg-green-900/20">
        <td className="w-10 px-2 text-right select-none text-green-500/60 border-r border-border-subtle/30" />
        <td className="w-10 px-2 text-right select-none text-green-500/60 border-r border-border-subtle/30">{line.newNum ?? ''}</td>
        <td className="w-6 px-1 text-center select-none text-green-500/60">+</td>
        <td className="px-2 whitespace-pre text-green-300">
          <HighlightedContent content={line.newLine || ''} searchTerm={searchTerm} />
        </td>
      </tr>
    );
  }

  return null;
};

/** Render word-level diff segments with inline highlights */
const WordDiffLine = ({ segments, type, searchTerm }: { segments: DiffSegment[]; type: 'added' | 'removed'; searchTerm: string }) => (
  <span>
    {segments.map((seg, i) => {
      if (seg.type === 'unchanged') {
        return <HighlightedContent key={i} content={seg.text} searchTerm={searchTerm} />;
      }
      const markClass = type === 'added'
        ? 'bg-green-500/30 rounded-sm px-0.5 [text-shadow:0_0_6px_rgba(34,197,94,0.4)]'
        : 'bg-red-500/30 rounded-sm px-0.5 [text-shadow:0_0_6px_rgba(239,68,68,0.4)]';
      return <mark key={i} className={markClass}>{seg.text}</mark>;
    })}
  </span>
);

/** Highlight search matches within content */
const HighlightedContent = ({ content, searchTerm }: { content: string; searchTerm: string }) => {
  if (!searchTerm || !content.toLowerCase().includes(searchTerm.toLowerCase())) {
    return <>{content || '\u00A0'}</>;
  }

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = content.split(regex);

  // split() with a capturing group puts matches at odd indices
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-500/30 rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};
