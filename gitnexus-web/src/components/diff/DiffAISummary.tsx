import { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertTriangle, Shield, Info } from 'lucide-react';
import type { DiffResult } from '../../types/diff';
import { generateDiffInsight } from '../../lib/diff-utils';

const RISK_ICONS: Record<string, typeof Info> = {
  none: Info, low: Shield, medium: Info, high: AlertTriangle, critical: AlertTriangle,
};
const RISK_COLORS: Record<string, string> = {
  none: 'text-gray-400', low: 'text-green-400', medium: 'text-amber-400', high: 'text-orange-400', critical: 'text-red-400',
};

export const DiffAISummary = ({ data }: { data: DiffResult }) => {
  const [expanded, setExpanded] = useState(true);
  const insight = useMemo(() => generateDiffInsight(data), [data]);
  const RiskIcon = RISK_ICONS[data.summary.riskLevel] || Info;
  const riskColor = RISK_COLORS[data.summary.riskLevel] || 'text-gray-400';

  return (
    <div className="flex-shrink-0 border-b border-border-subtle bg-surface/60">
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-hover/50 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
        <span className="text-xs font-medium text-text-primary flex-1 truncate">{insight.tldr}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Risk explanation */}
          <div className="flex items-start gap-2">
            <RiskIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${riskColor}`} />
            <span className="text-[11px] text-text-secondary">{insight.riskExplanation}</span>
          </div>

          {/* Per-file summaries */}
          {insight.fileSummaries.length > 0 && (
            <div className="space-y-0.5 pl-5">
              {insight.fileSummaries.map(({ filePath, summary }) => {
                const fileName = filePath.split('/').pop() || filePath;
                return (
                  <div key={filePath} className="text-[10px] text-text-muted truncate">
                    <span className="text-text-secondary">{fileName}</span>
                    <span className="mx-1">—</span>
                    {summary}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
