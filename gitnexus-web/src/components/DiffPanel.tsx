import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { X, FileCode, FilePlus2, FileMinus2, FileEdit, Target, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { getSyntaxLanguage } from '../lib/syntax-utils';
import type { DiffFile, DiffHunk } from '../types/diff';

const RISK_COLORS: Record<string, string> = {
  none: '#6b7280',
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const STATUS_ICONS: Record<string, typeof FileEdit> = {
  added: FilePlus2,
  modified: FileEdit,
  deleted: FileMinus2,
  renamed: FileCode,
};

const STATUS_COLORS: Record<string, string> = {
  added: '#22c55e',
  modified: '#f59e0b',
  deleted: '#ef4444',
  renamed: '#a78bfa',
};

interface DiffPanelProps {
  onFocusNode: (nodeId: string) => void;
}

export const DiffPanel = ({ onFocusNode }: DiffPanelProps) => {
  const {
    diffData,
    diffLoading,
    diffError,
    selectedDiffFile,
    setSelectedDiffFile,
    exitDiffMode,
  } = useAppState();

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('gitnexus-diff-panel-width');
    return saved ? Math.max(500, Math.min(1200, parseInt(saved))) : 680;
  });
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    const handleMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const newWidth = resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX);
      const clamped = Math.max(500, Math.min(1200, newWidth));
      setPanelWidth(clamped);
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      localStorage.setItem('gitnexus-diff-panel-width', String(panelWidth));
      resizeRef.current = null;
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [panelWidth]);

  // Persist width on change
  useEffect(() => {
    localStorage.setItem('gitnexus-diff-panel-width', String(panelWidth));
  }, [panelWidth]);

  const selectedFile = useMemo(() => {
    if (!diffData || !selectedDiffFile) return null;
    return diffData.files.find(f => f.filePath === selectedDiffFile) || null;
  }, [diffData, selectedDiffFile]);

  if (diffLoading) {
    return (
      <div className="h-full flex flex-col bg-deep border-r border-border-subtle" style={{ width: panelWidth }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-sm">Analyzing changes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (diffError) {
    return (
      <div className="h-full flex flex-col bg-deep border-r border-border-subtle" style={{ width: panelWidth }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-400 px-6 text-center">
            <AlertTriangle className="w-8 h-8" />
            <span className="text-sm">{diffError}</span>
            <button
              onClick={exitDiffMode}
              className="px-3 py-1.5 text-xs bg-elevated border border-border-subtle rounded-md text-text-secondary hover:text-text-primary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!diffData) return null;

  const { summary } = diffData;
  const risk = summary.riskLevel;

  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col bg-deep border-r border-border-subtle relative"
      style={{ width: panelWidth }}
    >
      {/* Summary header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border-subtle bg-surface/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">Diff View</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
              style={{ backgroundColor: RISK_COLORS[risk] + '30', color: RISK_COLORS[risk] }}
            >
              {risk} risk
            </span>
          </div>
          <button
            onClick={exitDiffMode}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>{summary.changedFiles} files</span>
          <span className="text-green-400">+{summary.additions}</span>
          <span className="text-red-400">-{summary.deletions}</span>
          <span>{summary.changedSymbolCount} symbols</span>
          <span>{summary.affectedProcessCount} processes</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* File list sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-border-subtle overflow-y-auto scrollbar-thin">
          {diffData.files.map(file => {
            const Icon = STATUS_ICONS[file.status] || FileEdit;
            const color = STATUS_COLORS[file.status] || '#6b7280';
            const isSelected = file.filePath === selectedDiffFile;
            const fileName = file.filePath.split('/').pop() || file.filePath;
            const dirPath = file.filePath.split('/').slice(0, -1).join('/');

            return (
              <button
                key={file.filePath}
                onClick={() => setSelectedDiffFile(file.filePath)}
                className={`w-full px-3 py-2 flex items-start gap-2 text-left transition-colors border-l-2 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-text-primary'
                    : 'border-transparent hover:bg-hover text-text-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{fileName}</div>
                  {dirPath && (
                    <div className="text-[10px] text-text-muted truncate">{dirPath}</div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-green-400">+{file.additions}</span>
                    <span className="text-[10px] text-red-400">-{file.deletions}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Diff content area */}
        <div className="flex-1 min-w-0 overflow-auto scrollbar-thin">
          {selectedFile ? (
            <DiffFileContent file={selectedFile} onFocusNode={onFocusNode} />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full text-text-muted text-sm">
              Select a file to view diff
            </div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/40 transition-colors z-10"
      />
    </div>
  );
};

/** Render a single file's diff hunks */
const DiffFileContent = ({ file, onFocusNode }: { file: DiffFile; onFocusNode: (id: string) => void }) => {
  const language = getSyntaxLanguage(file.filePath);

  return (
    <div className="text-xs font-mono">
      {/* File header */}
      <div className="sticky top-0 z-10 px-4 py-2 bg-surface/95 backdrop-blur-sm border-b border-border-subtle flex items-center justify-between">
        <span className="text-text-secondary truncate">{file.filePath}</span>
        {file.symbols.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
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
        )}
      </div>

      {/* Hunks */}
      {file.hunks.map((hunk, hunkIdx) => (
        <DiffHunkView key={hunkIdx} hunk={hunk} hunkIndex={hunkIdx} language={language} />
      ))}

      {file.hunks.length === 0 && (
        <div className="px-4 py-8 text-center text-text-muted">
          No diff content (binary or empty change)
        </div>
      )}
    </div>
  );
};

/** Render a single hunk */
const DiffHunkView = ({ hunk, hunkIndex, language }: { hunk: DiffHunk; hunkIndex: number; language: string }) => {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;

  return (
    <div className="border-b border-border-subtle/50">
      {/* Hunk header */}
      <div className="px-4 py-1 bg-surface/40 text-text-muted text-[10px] border-b border-border-subtle/30">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>

      {/* Lines */}
      <table className="w-full border-collapse">
        <tbody>
          {hunk.lines.map((line, lineIdx) => {
            const type = line[0]; // '+', '-', or ' '
            const content = line.substring(1);

            let oldNum: number | null = null;
            let newNum: number | null = null;

            if (type === '+') {
              newNum = newLine++;
            } else if (type === '-') {
              oldNum = oldLine++;
            } else {
              oldNum = oldLine++;
              newNum = newLine++;
            }

            const bgClass =
              type === '+' ? 'bg-green-900/20' :
              type === '-' ? 'bg-red-900/20' :
              '';

            const gutterClass =
              type === '+' ? 'text-green-500/60' :
              type === '-' ? 'text-red-500/60' :
              'text-text-muted/40';

            const contentClass =
              type === '+' ? 'text-green-300' :
              type === '-' ? 'text-red-300' :
              'text-text-secondary';

            return (
              <tr key={lineIdx} className={bgClass}>
                <td className={`w-10 px-2 text-right select-none ${gutterClass} border-r border-border-subtle/30`}>
                  {oldNum ?? ''}
                </td>
                <td className={`w-10 px-2 text-right select-none ${gutterClass} border-r border-border-subtle/30`}>
                  {newNum ?? ''}
                </td>
                <td className={`w-6 px-1 text-center select-none ${gutterClass}`}>
                  {type === '+' ? '+' : type === '-' ? '-' : ''}
                </td>
                <td className={`px-2 whitespace-pre ${contentClass}`}>
                  {content || '\u00A0'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
