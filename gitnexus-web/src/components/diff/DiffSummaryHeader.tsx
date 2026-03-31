import { useMemo, useState } from 'react';
import { X, Maximize2, LayoutGrid, Columns2, PanelLeftClose, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';
import type { DiffResult } from '../../types/diff';
import { categorizeRisks, generateDiffInsight } from '../../lib/diff-utils';

const RISK_COLORS: Record<string, string> = {
  none: '#6b7280', low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

const VIEW_MODES = [
  { key: 'focus' as const, label: 'Focus', shortcut: '1', icon: Maximize2 },
  { key: 'structure' as const, label: 'Structure', shortcut: '2', icon: LayoutGrid },
  { key: 'review' as const, label: 'Review', shortcut: '3', icon: Columns2 },
];

interface DiffSummaryHeaderProps {
  data: DiffResult;
  onClose: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export const DiffSummaryHeader = ({ data, onClose, onExpandChange }: DiffSummaryHeaderProps) => {
  const {
    diffViewMode, setDiffViewMode,
    diffRiskChipFilter, setDiffRiskChipFilter,
    toggleDiffPanel,
    diffGraphFilter, setDiffGraphFilter,
  } = useAppState();
  const { summary } = data;
  const risk = summary.riskLevel || 'none';
  const riskColor = RISK_COLORS[risk] || RISK_COLORS.none;
  const chips = useMemo(() => categorizeRisks(data), [data]);
  const insight = useMemo(() => generateDiffInsight(data), [data]);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  };

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-border-subtle bg-surface/60">
      {/* Top row: title + mode pills + collapse + close */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Diff View</span>
          <span
            className="px-2 py-0.5 rounded text-xs font-bold uppercase"
            style={{ backgroundColor: riskColor + '30', color: riskColor }}
          >
            {risk}
          </span>
        </div>

        {/* View mode pills */}
        <div className="flex items-center gap-0.5 bg-elevated rounded-lg border border-border-subtle p-0.5">
          {VIEW_MODES.map(mode => {
            const Icon = mode.icon;
            const active = diffViewMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setDiffViewMode(mode.key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  active
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                title={`${mode.label} (${mode.shortcut})`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{mode.label}</span>
                <kbd className="px-0.5 text-[8px] opacity-50">{mode.shortcut}</kbd>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleDiffPanel}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
            title="Collapse panel"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Condensed summary (always visible) */}
      <div className="text-xs text-text-muted leading-relaxed">
        <p className="text-text-secondary">{insight.tldr}</p>
        <p className="mt-0.5">
          <span style={{ color: riskColor }}>{risk.charAt(0).toUpperCase() + risk.slice(1)} risk</span>
          {': '}
          {insight.riskExplanation.replace(/^(Critical|High|Medium|Low) risk: /, '')}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={handleExpandToggle}
            className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-0.5"
          >
            {isExpanded ? 'see less' : 'see more...'}
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setDiffGraphFilter(diffGraphFilter === 'all' ? 'impacted' : 'all')}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            {diffGraphFilter === 'impacted' ? 'Show all nodes' : 'Impacted only'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-border-subtle/50 space-y-2 animate-fade-in">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>{summary.changedFiles} files</span>
            <span className="text-green-400">+{summary.additions}</span>
            <span className="text-red-400">-{summary.deletions}</span>
            <span>{summary.changedSymbolCount} symbols</span>
            <span>{summary.affectedProcessCount} processes</span>
          </div>

          {/* Risk chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map(chip => {
                const active = diffRiskChipFilter === chip.category;
                return (
                  <button
                    key={chip.category}
                    onClick={() => setDiffRiskChipFilter(active ? null : chip.category)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                      active ? 'ring-1 ring-offset-1 ring-offset-surface' : ''
                    }`}
                    style={{
                      backgroundColor: chip.bgColor,
                      color: chip.color,
                      ...(active ? { ringColor: chip.color } : {}),
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
              {diffRiskChipFilter && (
                <button
                  onClick={() => setDiffRiskChipFilter(null)}
                  className="px-2 py-0.5 rounded-full text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
