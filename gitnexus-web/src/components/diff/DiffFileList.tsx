import { useMemo, useState, useCallback } from 'react';
import { FileCode, FilePlus2, FileMinus2, FileEdit, AlertTriangle, RefreshCw, ArrowUpDown } from 'lucide-react';
import type { DiffFile } from '../../types/diff';
import { generateFileIntent, sortByChanges, sortByRisk, sortByAlpha, sortByDirectory } from '../../lib/diff-utils';
import type { DiffFileSortBy } from '../../lib/diff-utils';

const STATUS_ICONS: Record<string, typeof FileEdit> = {
  added: FilePlus2, modified: FileEdit, deleted: FileMinus2, renamed: FileCode,
};

const STATUS_COLORS: Record<string, string> = {
  added: '#22c55e', modified: '#f59e0b', deleted: '#ef4444', renamed: '#a78bfa',
};

const SORT_OPTIONS: { key: DiffFileSortBy; label: string }[] = [
  { key: 'changes', label: 'Most changed' },
  { key: 'risk', label: 'Highest risk' },
  { key: 'alpha', label: 'Alphabetical' },
  { key: 'directory', label: 'By directory' },
];

interface DiffFileListProps {
  files: DiffFile[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onHoverFile?: (path: string | null) => void;
  onFocusGraphNode?: (nodeId: string) => void;
  loading?: boolean;
  groupBy?: 'flat' | 'module' | 'changeType' | 'risk';
  sortBy?: DiffFileSortBy;
  onSortChange?: (sort: DiffFileSortBy) => void;
}

export const DiffFileList = ({ files, selectedFile, onSelectFile, onHoverFile, onFocusGraphNode, loading, groupBy = 'flat', sortBy = 'changes', onSortChange }: DiffFileListProps) => {
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    switch (sortBy) {
      case 'changes': sorted.sort(sortByChanges); break;
      case 'risk': sorted.sort(sortByRisk); break;
      case 'alpha': sorted.sort(sortByAlpha); break;
      case 'directory': sorted.sort(sortByDirectory); break;
    }
    return sorted;
  }, [files, sortBy]);

  const handleFileClick = useCallback((file: DiffFile) => {
    onSelectFile(file.filePath);
    // Step 4: Diff→Graph linking - find the corresponding graph node and focus it
    if (onFocusGraphNode) {
      // Try symbol IDs first, then fall back to file node
      const directSymbol = file.symbols.find(s => s.changeScope === 'directly_changed');
      if (directSymbol) {
        onFocusGraphNode(directSymbol.id);
      }
    }
  }, [onSelectFile, onFocusGraphNode]);

  if (loading) {
    return (
      <div className="w-52 flex-shrink-0 border-r border-border-subtle p-3 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-1">
            <div className="h-3 w-28 bg-elevated rounded" />
            <div className="h-2 w-20 bg-elevated/50 rounded" />
            <div className="h-2 w-12 bg-elevated/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-52 flex-shrink-0 border-r border-border-subtle overflow-y-auto scrollbar-thin" data-testid="diff-file-list">
      {/* Step 6: Sort dropdown */}
      <div className="px-2 py-1.5 border-b border-border-subtle/50 flex items-center justify-between">
        <span className="text-[10px] text-text-muted">{sortedFiles.length} files</span>
        <div className="relative">
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
            title="Sort files"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>{SORT_OPTIONS.find(o => o.key === sortBy)?.label || 'Sort'}</span>
          </button>
          {isSortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-elevated border border-border-subtle rounded-lg shadow-lg py-1 min-w-[130px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      onSortChange?.(opt.key);
                      setIsSortOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                      sortBy === opt.key
                        ? 'text-amber-300 bg-amber-500/10'
                        : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {sortedFiles.map(file => {
        const Icon = STATUS_ICONS[file.status] || FileEdit;
        const color = STATUS_COLORS[file.status] || '#6b7280';
        const isSelected = file.filePath === selectedFile;
        const fileName = file.filePath.split('/').pop() || file.filePath;
        const dirPath = file.filePath.split('/').slice(0, -1).join('/');

        // Badges
        const isLarge = file.additions + file.deletions > 100;
        const hasBreaking = file.symbols.some(s => s.changeScope === 'directly_changed');
        const isRename = file.status === 'renamed';

        // Border and background based on status
        const borderColor = isSelected
          ? (hasBreaking ? 'border-amber-500' : 'border-blue-500')
          : 'border-transparent';

        const statusBg = isSelected
          ? 'bg-amber-500/15'
          : file.status === 'added' ? 'bg-green-900/5'
          : file.status === 'deleted' ? 'bg-red-900/5'
          : '';

        // Heat bar
        const addRatio = file.additions / Math.max(1, file.additions + file.deletions);
        const intent = generateFileIntent(file);

        return (
          <button
            key={file.filePath}
            onClick={() => handleFileClick(file)}
            onMouseEnter={() => onHoverFile?.(file.filePath)}
            onMouseLeave={() => onHoverFile?.(null)}
            className={`w-full flex items-stretch text-left transition-colors ${
              isSelected
                ? `${statusBg} text-text-primary`
                : `${statusBg} hover:bg-hover text-text-secondary`
            }`}
          >
            {/* Heat bar */}
            <div
              className={`w-1 flex-shrink-0 ${isSelected ? '' : 'opacity-60'}`}
              style={{
                background: `linear-gradient(to bottom, #22c55e ${addRatio * 100}%, #ef4444 ${addRatio * 100}%)`,
              }}
            />
            {/* Border indicator */}
            <div className={`w-0.5 flex-shrink-0 ${isSelected ? borderColor.replace('border-', 'bg-') : ''}`} />

            <div className="flex items-start gap-2 px-2 py-2 min-w-0 flex-1">
              <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-medium truncate flex items-center gap-1 ${file.status === 'deleted' ? 'line-through opacity-60' : ''}`}>
                  {fileName}
                  {isLarge && (
                    <span className="px-1 py-0 rounded text-[8px] bg-amber-500/20 text-amber-400 font-semibold">LG</span>
                  )}
                  {hasBreaking && (
                    <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                  )}
                  {isRename && (
                    <RefreshCw className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                  )}
                </div>
                {dirPath && (
                  <div className="text-[10px] text-text-muted truncate">{dirPath}</div>
                )}
                {/* Intent label */}
                <div className="text-[9px] text-text-muted/70 truncate italic">{intent}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-400">+{file.additions}</span>
                  <span className="text-[10px] text-red-400">-{file.deletions}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {/* Legend */}
      <div className="px-3 py-2 border-t border-border-subtle/50 text-[9px] text-text-muted space-y-0.5">
        <div className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5 text-red-400" /> Breaking potential</div>
        <div className="flex items-center gap-1"><span className="px-1 rounded bg-amber-500/20 text-amber-400 text-[8px]">LG</span> Large change</div>
        <div className="flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 text-blue-400" /> Rename/refactor</div>
      </div>
    </div>
  );
};
