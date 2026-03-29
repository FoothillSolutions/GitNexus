import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';
import { useDiffPreferences } from '../../hooks/useDiffPreferences';
import { DiffSummaryHeader } from './DiffSummaryHeader';
import { DiffAISummary } from './DiffAISummary';
import { DiffTimelineBar } from './DiffTimelineBar';
import { DiffToolbar } from './DiffToolbar';
import { DiffFileList } from './DiffFileList';
import { DiffFileContent } from './DiffFileContent';
import { GuidedReview } from './GuidedReview';
import { categorizeRisks } from '../../lib/diff-utils';

interface DiffPanelProps {
  onFocusNode: (nodeId: string) => void;
  fullWidth?: boolean;
}

export const DiffPanel = ({ onFocusNode, fullWidth }: DiffPanelProps) => {
  const {
    diffData,
    diffLoading,
    diffError,
    selectedDiffFile,
    setSelectedDiffFile,
    exitDiffMode,
    startDiff,
    reviewFlowActive,
    setReviewFlowActive,
    diffFileGrouping,
    diffRiskChipFilter,
  } = useAppState();

  const { prefs, setPreference, togglePreference } = useDiffPreferences();

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('gitnexus-diff-panel-width');
    return saved ? Math.max(500, Math.min(1200, parseInt(saved))) : 720;
  });
  const [activeCommit, setActiveCommit] = useState<string | null>(null);
  // Preserve original base/head refs for "Show All" after timeline navigation
  const originalRefsRef = useRef<{ base: string; head: string } | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Capture original refs when diff data first loads (not from timeline nav)
  useEffect(() => {
    if (diffData?.summary && !activeCommit) {
      originalRefsRef.current = { base: diffData.summary.base, head: diffData.summary.head };
    }
  }, [diffData, activeCommit]);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    const handleMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const newWidth = resizeRef.current.startWidth + (e.clientX - resizeRef.current.startX);
      setPanelWidth(Math.max(500, Math.min(1200, newWidth)));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      resizeRef.current = null;
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [panelWidth]);

  useEffect(() => {
    localStorage.setItem('gitnexus-diff-panel-width', String(panelWidth));
  }, [panelWidth]);

  // Filtered files based on preferences and risk chip
  const filteredFiles = useMemo(() => {
    if (!diffData) return [];
    let files = diffData.files;
    if (prefs.fileTypeFilters.length > 0) {
      files = files.filter(f => {
        const ext = f.filePath.split('.').pop()?.toLowerCase() || '';
        return prefs.fileTypeFilters.includes(ext);
      });
    }
    // Risk chip filtering
    if (diffRiskChipFilter) {
      const chips = categorizeRisks(diffData);
      const chip = chips.find(c => c.category === diffRiskChipFilter);
      if (chip && chip.matchingFiles.length > 0) {
        const matchSet = new Set(chip.matchingFiles);
        files = files.filter(f => matchSet.has(f.filePath));
      }
    }
    return files;
  }, [diffData, prefs.fileTypeFilters, diffRiskChipFilter]);

  // File extensions for filter chips
  const fileExtensions = useMemo(() => {
    if (!diffData) return [];
    const exts = new Set<string>();
    for (const f of diffData.files) {
      const ext = f.filePath.split('.').pop()?.toLowerCase();
      if (ext) exts.add(ext);
    }
    return Array.from(exts).sort();
  }, [diffData]);

  const selectedFile = useMemo(() => {
    if (!selectedDiffFile) return null;
    return filteredFiles.find(f => f.filePath === selectedDiffFile) || null;
  }, [filteredFiles, selectedDiffFile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panelRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (!diffData) return;

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        // Next file
        const idx = filteredFiles.findIndex(f => f.filePath === selectedDiffFile);
        if (idx < filteredFiles.length - 1) {
          setSelectedDiffFile(filteredFiles[idx + 1].filePath);
        }
      } else if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
        // Previous file
        const idx = filteredFiles.findIndex(f => f.filePath === selectedDiffFile);
        if (idx > 0) {
          setSelectedDiffFile(filteredFiles[idx - 1].filePath);
        }
      } else if (e.key === 'j') {
        handleJumpNext();
      } else if (e.key === 'k') {
        handleJumpPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [diffData, filteredFiles, selectedDiffFile, setSelectedDiffFile]);

  // Jump between hunks
  const handleJumpNext = useCallback(() => {
    const hunks = panelRef.current?.querySelectorAll('[data-hunk-index]');
    if (!hunks) return;
    const scrollContainer = panelRef.current?.querySelector('.overflow-auto');
    if (!scrollContainer) return;

    const containerTop = scrollContainer.scrollTop;
    for (const el of Array.from(hunks)) {
      const top = (el as HTMLElement).offsetTop - 60;
      if (top > containerTop + 10) {
        scrollContainer.scrollTo({ top, behavior: 'smooth' });
        break;
      }
    }
  }, []);

  const handleJumpPrev = useCallback(() => {
    const hunks = panelRef.current?.querySelectorAll('[data-hunk-index]');
    if (!hunks) return;
    const scrollContainer = panelRef.current?.querySelector('.overflow-auto');
    if (!scrollContainer) return;

    const containerTop = scrollContainer.scrollTop;
    const arr = Array.from(hunks).reverse();
    for (const el of arr) {
      const top = (el as HTMLElement).offsetTop - 60;
      if (top < containerTop - 10) {
        scrollContainer.scrollTo({ top, behavior: 'smooth' });
        break;
      }
    }
  }, []);

  // Timeline commit selection
  const handleSelectCommit = useCallback(async (sha: string) => {
    setActiveCommit(sha);
    await startDiff(`${sha}~1`, sha);
  }, [startDiff]);

  const handleShowAll = useCallback(() => {
    setActiveCommit(null);
    const orig = originalRefsRef.current;
    if (orig) {
      startDiff(orig.base, orig.head);
    }
  }, [startDiff]);

  // Loading state
  if (diffLoading) {
    return (
      <div className="h-full flex flex-col bg-deep border-r border-border-subtle" style={{ width: fullWidth ? '100%' : panelWidth }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-sm">Analyzing changes...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (diffError) {
    return (
      <div className="h-full flex flex-col bg-deep border-r border-border-subtle" style={{ width: fullWidth ? '100%' : panelWidth }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-400 px-6 text-center">
            <AlertTriangle className="w-8 h-8" />
            <span className="text-sm">{diffError}</span>
            <button onClick={exitDiffMode} className="px-3 py-1.5 text-xs bg-elevated border border-border-subtle rounded-md text-text-secondary hover:text-text-primary transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!diffData) return null;

  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col bg-deep border-r border-border-subtle relative"
      style={{ width: fullWidth ? '100%' : panelWidth }}
      tabIndex={0}
    >
      {/* Summary header */}
      <DiffSummaryHeader data={diffData} onClose={exitDiffMode} />

      {/* AI Summary (collapsible) */}
      {prefs.showAISummary && <DiffAISummary data={diffData} />}

      {/* Timeline bar */}
      {diffData.commits.length > 0 && (
        <DiffTimelineBar
          commits={diffData.commits}
          activeCommit={activeCommit}
          onSelectCommit={handleSelectCommit}
          onShowAll={handleShowAll}
        />
      )}

      {/* Toolbar */}
      <DiffToolbar
        prefs={prefs}
        setPreference={setPreference}
        togglePreference={togglePreference}
        onJumpPrev={handleJumpPrev}
        onJumpNext={handleJumpNext}
        fileExtensions={fileExtensions}
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* File list */}
        <DiffFileList
          files={filteredFiles}
          selectedFile={selectedDiffFile}
          onSelectFile={setSelectedDiffFile}
          loading={diffLoading}
          groupBy={diffFileGrouping}
        />

        {/* Diff content */}
        <div className="flex-1 min-w-0">
          {selectedFile ? (
            <DiffFileContent file={selectedFile} prefs={prefs} onFocusNode={onFocusNode} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
              <span className="text-text-muted text-sm">Select a file to view diff</span>
              {!reviewFlowActive && (
                <button
                  onClick={() => setReviewFlowActive(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Start Guided Review
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guided Review bar */}
      <GuidedReview />

      {/* Resize handle (hidden in fullWidth) */}
      {!fullWidth && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/40 transition-colors z-10"
        />
      )}
    </div>
  );
};
