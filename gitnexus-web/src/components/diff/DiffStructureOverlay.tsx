import { useMemo } from 'react';
import { Eye, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';
import { categorizeRisks } from '../../lib/diff-utils';

const RISK_COLORS: Record<string, string> = {
  none: '#6b7280', low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

export const DiffStructureOverlay = () => {
  const { diffData, setDiffViewMode, exitDiffMode } = useAppState();
  if (!diffData) return null;

  const { summary } = diffData;
  const risk = summary.riskLevel || 'none';
  const riskColor = RISK_COLORS[risk] || RISK_COLORS.none;
  const chips = useMemo(() => categorizeRisks(diffData), [diffData]);

  return (
    <div className="w-80 bg-surface/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-text-primary">Structure View</span>
        </div>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
          style={{ backgroundColor: riskColor + '30', color: riskColor }}
        >
          {risk}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-elevated rounded-lg px-2 py-1.5">
          <div className="text-lg font-bold text-text-primary">{summary.changedFiles}</div>
          <div className="text-[9px] text-text-muted">Files</div>
        </div>
        <div className="bg-elevated rounded-lg px-2 py-1.5">
          <div className="text-lg font-bold text-text-primary">{summary.changedSymbolCount}</div>
          <div className="text-[9px] text-text-muted">Symbols</div>
        </div>
        <div className="bg-elevated rounded-lg px-2 py-1.5">
          <div className="text-lg font-bold text-text-primary">{summary.affectedProcessCount}</div>
          <div className="text-[9px] text-text-muted">Processes</div>
        </div>
      </div>

      {/* Changes */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-green-400 font-medium">+{summary.additions}</span>
        <span className="text-red-400 font-medium">-{summary.deletions}</span>
        <span className="text-text-muted">{summary.base} .. {summary.head}</span>
      </div>

      {/* Risk chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map(chip => (
            <span
              key={chip.category}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: chip.bgColor, color: chip.color }}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setDiffViewMode('review')}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
        >
          Review Diff <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={exitDiffMode}
          className="px-3 py-1.5 bg-elevated border border-border-subtle rounded-lg text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="text-[9px] text-text-muted/50 text-center">
        Press <kbd className="px-1 py-0.5 bg-elevated rounded text-[8px]">1</kbd> Focus
        <kbd className="px-1 py-0.5 bg-elevated rounded text-[8px] ml-2">2</kbd> Structure
        <kbd className="px-1 py-0.5 bg-elevated rounded text-[8px] ml-2">3</kbd> Review
      </div>
    </div>
  );
};
