import { useState, useEffect, useCallback } from 'react';
import { GitCompareArrows, Loader2, ChevronDown, AlertTriangle, SkipForward } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { fetchBranches } from '../services/backend';

export const BranchDiffDialog = () => {
  const {
    projectName,
    commitServerConnection,
    startDiff,
    diffLoading,
    diffError,
    setDiffGraphFilter,
  } = useAppState();

  const [branches, setBranches] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [headRef, setHeadRef] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Load branches on mount
  useEffect(() => {
    if (!projectName) return;
    (async () => {
      try {
        const result = await fetchBranches(projectName);
        setBranches(result.branches);
        setTags(result.tags);
        setCurrentBranch(result.currentBranch);
        // Default base: "main" if it exists, otherwise first branch
        const hasMain = result.branches.includes('main');
        setBaseRef(hasMain ? 'main' : (result.branches[0] || ''));
        setHeadRef(result.currentBranch || 'HEAD');
      } catch {
        // Non-fatal — user can still skip
      } finally {
        setLoadingBranches(false);
      }
    })();
  }, [projectName]);

  const handleCompare = useCallback(async () => {
    if (!baseRef) return;
    commitServerConnection();
    setDiffGraphFilter('impacted');
    await startDiff(baseRef, headRef || undefined);
  }, [baseRef, headRef, commitServerConnection, startDiff, setDiffGraphFilter]);

  const handleSkip = useCallback(() => {
    commitServerConnection();
  }, [commitServerConnection]);

  const allRefs = [...branches, ...tags.map(t => `tags/${t}`)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 40%, rgba(245, 158, 11, 0.06) 0%, transparent 60%),
              radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 70%)
            `
          }}
        />
      </div>

      {/* Dialog */}
      <div
        className={`relative bg-surface border border-border-subtle rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transition-all duration-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-6 py-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center bg-amber-500/20 rounded-xl">
              <GitCompareArrows className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Compare Branches</h2>
              <p className="text-sm text-text-muted mt-0.5">{projectName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-text-secondary">
            Select two branches to compare. The graph will show only the impacted nodes.
          </p>

          {loadingBranches ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-4 justify-center">
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
                    className="w-full px-3 py-2 bg-elevated border border-border-subtle rounded-lg text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  >
                    <option value="">Select branch...</option>
                    {allRefs.map(ref => (
                      <option key={ref} value={ref}>{ref}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Head ref */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Compare (to)</label>
                <div className="relative">
                  <select
                    value={headRef}
                    onChange={(e) => setHeadRef(e.target.value)}
                    className="w-full px-3 py-2 bg-elevated border border-border-subtle rounded-lg text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  >
                    <option value="HEAD">HEAD (working tree)</option>
                    {allRefs.map(ref => (
                      <option key={ref} value={ref}>{ref}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </div>

              {diffError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {diffError}
                </div>
              )}
            </div>
          )}

          {currentBranch && !loadingBranches && (
            <p className="text-xs text-text-muted">
              Current branch: <span className="text-text-secondary">{currentBranch}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-elevated/30 border-t border-border-subtle flex gap-3">
          <button
            onClick={handleSkip}
            disabled={diffLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-surface border border-border-subtle rounded-lg hover:bg-hover hover:text-text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-4 h-4" />
            Skip, Show Full Graph
          </button>
          <button
            onClick={handleCompare}
            disabled={!baseRef || diffLoading || loadingBranches}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {diffLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <GitCompareArrows className="w-4 h-4" />
                Compare & Load
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
