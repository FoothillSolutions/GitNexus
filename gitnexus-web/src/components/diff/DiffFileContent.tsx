import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Target, Copy, Check, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';
import type { DiffFile } from '../../types/diff';
import type { DiffPreferences } from '../../hooks/useDiffPreferences';
import { getSyntaxLanguage } from '../../lib/syntax-utils';
import { groupHunksBySymbol, type SymbolGroup } from '../../lib/diff-utils';
import { DiffHunkView } from './DiffHunkView';
import { DiffSplitView } from './DiffSplitView';
import { DiffMinimap } from './DiffMinimap';

interface DiffFileContentProps {
  file: DiffFile;
  prefs: DiffPreferences;
  onFocusNode: (nodeId: string) => void;
}

export const DiffFileContent = ({ file, prefs, onFocusNode }: DiffFileContentProps) => {
  const { diffFocusedSymbolId, setDiffFocusedSymbolId } = useAppState();
  const language = getSyntaxLanguage(file.filePath);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: 0, height: 0, client: 0 });
  const [copiedPath, setCopiedPath] = useState(false);

  // Scroll to focused symbol when graph node is clicked
  useEffect(() => {
    if (!diffFocusedSymbolId || !scrollRef.current) return;
    const sym = file.symbols.find(s => s.id === diffFocusedSymbolId);
    if (!sym) return;
    const hunkElements = scrollRef.current.querySelectorAll('[data-hunk-index]');
    for (const el of Array.from(hunkElements)) {
      if (el.textContent?.includes(sym.name)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).style.outline = '2px solid rgba(251, 191, 36, 0.5)';
        setTimeout(() => { (el as HTMLElement).style.outline = ''; }, 2000);
        break;
      }
    }
    setDiffFocusedSymbolId(null);
  }, [diffFocusedSymbolId, file, setDiffFocusedSymbolId]);

  // Track scroll for minimap
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      setScrollState({ top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight });
    }
  }, []);

  // Scroll to top on file change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [file.filePath]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(file.filePath).then(() => {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1500);
    });
  }, [file.filePath]);

  const handleMinimapSeek = useCallback((ratio: number) => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
    }
  }, []);

  // Group hunks by symbol
  const symbolGroups = useMemo(() => {
    if (!prefs.groupBySymbol) return null;
    return groupHunksBySymbol(file.hunks, file.symbols);
  }, [prefs.groupBySymbol, file.hunks, file.symbols]);

  // Check if file has directly changed symbols
  const hasDirectlyChanged = file.symbols.some(s => s.changeScope === 'directly_changed');

  return (
    <div className="flex h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-w-0 overflow-auto scrollbar-thin text-xs font-mono">
        {/* File header */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-surface/95 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-secondary truncate">{file.filePath}</span>
            <button
              onClick={handleCopyPath}
              className="flex-shrink-0 p-0.5 rounded hover:bg-hover transition-colors text-text-muted"
              title="Copy file path"
            >
              {copiedPath ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Symbol badges */}
            {file.symbols.slice(0, 5).map(sym => (
              <button
                key={sym.id}
                onClick={() => onFocusNode(sym.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  sym.changeScope === 'directly_changed'
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-elevated text-text-muted hover:bg-hover hover:text-text-secondary'
                }`}
                title={`${sym.name} (${sym.type}) — ${sym.changeScope === 'directly_changed' ? 'directly changed' : 'in changed file'}`}
              >
                <Target className="w-2.5 h-2.5 inline mr-0.5" />
                {sym.name}
              </button>
            ))}
            {file.symbols.length > 5 && (
              <span className="text-[10px] text-text-muted">+{file.symbols.length - 5}</span>
            )}
          </div>
        </div>

        {/* Content: split or unified, grouped or flat */}
        {prefs.viewMode === 'split' ? (
          <DiffSplitView
            hunks={file.hunks}
            language={language}
            hideFormatting={prefs.hideFormatting}
            searchTerm={prefs.searchTerm}
          />
        ) : symbolGroups ? (
          <GroupedHunks
            groups={symbolGroups}
            language={language}
            prefs={prefs}
            onFocusNode={onFocusNode}
            hasDirectlyChanged={hasDirectlyChanged}
          />
        ) : (
          file.hunks.map((hunk, idx) => (
            <DiffHunkView
              key={idx}
              hunk={hunk}
              hunkIndex={idx}
              language={language}
              hideFormatting={prefs.hideFormatting}
              collapseThreshold={prefs.collapseThreshold}
              searchTerm={prefs.searchTerm}
              hasDirectlyChangedSymbol={hasDirectlyChanged}
            />
          ))
        )}

        {file.hunks.length === 0 && (
          <div className="px-4 py-8 text-center text-text-muted">
            No diff content (binary or empty change)
          </div>
        )}
      </div>

      {/* Minimap */}
      <DiffMinimap
        file={file}
        scrollTop={scrollState.top}
        scrollHeight={scrollState.height}
        clientHeight={scrollState.client}
        onSeek={handleMinimapSeek}
      />
    </div>
  );
};

/** Render hunks grouped by symbol with collapsible sections */
const GroupedHunks = ({
  groups, language, prefs, onFocusNode, hasDirectlyChanged,
}: {
  groups: SymbolGroup[];
  language: string;
  prefs: DiffPreferences;
  onFocusNode: (id: string) => void;
  hasDirectlyChanged: boolean;
}) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleGroup = useCallback((idx: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <div>
      {groups.map((group, gIdx) => {
        const isCollapsed = collapsed.has(gIdx);
        const label = group.symbol
          ? group.symbol.name
          : 'Other Changes';
        const typeBadge = group.symbol?.type;

        return (
          <div key={gIdx} className="border-b border-border-subtle">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(gIdx)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-surface/30 hover:bg-hover/50 transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
              {typeBadge && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 uppercase">
                  {typeBadge}
                </span>
              )}
              <span className="text-xs font-medium text-text-primary">{label}</span>
              <span className="text-[10px] text-green-400">+{group.totalAdditions}</span>
              <span className="text-[10px] text-red-400">-{group.totalDeletions}</span>
              {group.symbol && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFocusNode(group.symbol!.id); }}
                  className="ml-auto p-0.5 rounded hover:bg-hover text-text-muted hover:text-amber-300 transition-colors"
                  title="Focus in graph"
                >
                  <Target className="w-3 h-3" />
                </button>
              )}
            </button>

            {/* Group hunks */}
            {!isCollapsed && group.hunks.map((hunk, hIdx) => (
              <DiffHunkView
                key={hIdx}
                hunk={hunk}
                hunkIndex={hIdx}
                language={language}
                hideFormatting={prefs.hideFormatting}
                collapseThreshold={prefs.collapseThreshold}
                searchTerm={prefs.searchTerm}
                hasDirectlyChangedSymbol={hasDirectlyChanged}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
