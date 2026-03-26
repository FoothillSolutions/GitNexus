import { useState, useEffect, useRef, useCallback } from 'react';
import { GitCompareArrows, X, Loader2, ChevronDown, AlertTriangle } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { fetchBranches } from '../services/backend';

const RISK_COLORS: Record<string, string> = {
  none: '#6b7280',
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export const DiffSelector = () => {
  const {
    projectName,
    serverBaseUrl,
    isDiffMode,
    diffData,
    diffLoading,
    diffError,
    startDiff,
    exitDiffMode,
  } = useAppState();

  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [headRef, setHeadRef] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load branches when dropdown opens
  const loadBranches = useCallback(async () => {
    if (!projectName) return;
    setLoadingBranches(true);
    try {
      const result = await fetchBranches(projectName);
      setBranches(result.branches);
      setTags(result.tags);
      setCurrentBranch(result.currentBranch);
      if (!baseRef) setBaseRef('main');
      if (!headRef) setHeadRef(result.currentBranch || 'HEAD');
    } catch {
      // Non-fatal
    } finally {
      setLoadingBranches(false);
    }
  }, [projectName, baseRef, headRef]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    loadBranches();
  }, [loadBranches]);

  const handleCompare = useCallback(() => {
    if (!baseRef) return;
    startDiff(baseRef, headRef || undefined);
    setIsOpen(false);
  }, [baseRef, headRef, startDiff]);

  // Don't show if not connected to server
  if (!serverBaseUrl) return null;

  // When diff mode is active, show summary badge
  if (isDiffMode && diffData) {
    const risk = diffData.summary.riskLevel;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-amber-500/30 rounded-lg text-sm">
          <GitCompareArrows className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-text-secondary">
            {diffData.summary.base}
            <span className="text-text-muted mx-1">..</span>
            {diffData.summary.head}
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-green-400">+{diffData.summary.additions}</span>
          <span className="text-red-400">-{diffData.summary.deletions}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
            style={{ backgroundColor: RISK_COLORS[risk] + '30', color: RISK_COLORS[risk] }}
          >
            {risk}
          </span>
        </div>
        <button
          onClick={exitDiffMode}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Exit diff mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const allRefs = [...branches, ...tags.map(t => `tags/${t}`)];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
        title="Compare branches"
      >
        <GitCompareArrows className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Diff</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-surface border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="text-sm font-medium text-text-primary mb-3">Compare Branches</div>

            {loadingBranches ? (
              <div className="flex items-center gap-2 text-sm text-text-muted py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading branches...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Base ref */}
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Base (from)</label>
                  <div className="relative">
                    <select
                      value={baseRef}
                      onChange={(e) => setBaseRef(e.target.value)}
                      className="w-full px-3 py-1.5 bg-elevated border border-border-subtle rounded-md text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-accent"
                    >
                      <option value="">Select branch...</option>
                      {allRefs.map(ref => (
                        <option key={ref} value={ref}>{ref}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {/* Head ref */}
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Compare (to)</label>
                  <div className="relative">
                    <select
                      value={headRef}
                      onChange={(e) => setHeadRef(e.target.value)}
                      className="w-full px-3 py-1.5 bg-elevated border border-border-subtle rounded-md text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-accent"
                    >
                      <option value="HEAD">HEAD (working tree)</option>
                      {allRefs.map(ref => (
                        <option key={ref} value={ref}>{ref}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  </div>
                </div>

                {diffError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {diffError}
                  </div>
                )}

                <button
                  onClick={handleCompare}
                  disabled={!baseRef || diffLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-md text-sm font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {diffLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <GitCompareArrows className="w-4 h-4" />
                      Compare
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {currentBranch && (
            <div className="px-4 py-2 text-xs text-text-muted">
              Current branch: <span className="text-text-secondary">{currentBranch}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
