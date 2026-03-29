import { X } from 'lucide-react';
import type { DiffSummary } from '../../types/diff';

const RISK_COLORS: Record<string, string> = {
  none: '#6b7280', low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

export const DiffSummaryHeader = ({ summary, onClose }: { summary: DiffSummary; onClose: () => void }) => {
  const risk = summary.riskLevel || 'none';
  const riskColor = RISK_COLORS[risk] || RISK_COLORS.none;
  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-border-subtle bg-surface/60">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Diff View</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
            style={{ backgroundColor: riskColor + '30', color: riskColor }}
          >
            {risk} risk
          </span>
        </div>
        <button
          onClick={onClose}
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
  );
};
