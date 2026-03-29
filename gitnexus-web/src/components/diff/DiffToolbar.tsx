import { Rows3, Columns2, EyeOff, Layers, ChevronUp, ChevronDown, Search, Sparkles, ChevronsUpDown } from 'lucide-react';
import type { DiffPreferences } from '../../hooks/useDiffPreferences';
import { CHANGE_CATEGORY_COLORS } from '../../lib/diff-utils';

interface DiffToolbarProps {
  prefs: DiffPreferences;
  setPreference: <K extends keyof DiffPreferences>(key: K, value: DiffPreferences[K]) => void;
  togglePreference: (key: keyof DiffPreferences) => void;
  onJumpPrev: () => void;
  onJumpNext: () => void;
  fileExtensions: string[];
}

export const DiffToolbar = ({
  prefs, setPreference, togglePreference,
  onJumpPrev, onJumpNext, fileExtensions,
}: DiffToolbarProps) => {
  return (
    <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border-subtle bg-surface/40 overflow-x-auto">
      {/* View mode toggle */}
      <div className="flex items-center bg-elevated rounded-md border border-border-subtle">
        <button
          onClick={() => setPreference('viewMode', 'unified')}
          className={`p-1 rounded-l-md transition-colors ${
            prefs.viewMode === 'unified'
              ? 'bg-amber-500/20 text-amber-300'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          title="Unified view"
        >
          <Rows3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPreference('viewMode', 'split')}
          className={`p-1 rounded-r-md transition-colors ${
            prefs.viewMode === 'split'
              ? 'bg-amber-500/20 text-amber-300'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          title="Split view"
        >
          <Columns2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* Formatting toggle */}
      <button
        onClick={() => togglePreference('hideFormatting')}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${
          prefs.hideFormatting
            ? 'bg-blue-500/20 text-blue-300'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Hide formatting-only changes"
      >
        <EyeOff className="w-3 h-3" />
        <span className="hidden lg:inline">Formatting</span>
      </button>

      {/* Group by symbol */}
      <button
        onClick={() => togglePreference('groupBySymbol')}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${
          prefs.groupBySymbol
            ? 'bg-amber-500/20 text-amber-300'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Group changes by function/class"
      >
        <Layers className="w-3 h-3" />
        <span className="hidden lg:inline">Group</span>
      </button>

      {/* AI Summary toggle */}
      <button
        onClick={() => togglePreference('showAISummary')}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${
          prefs.showAISummary
            ? 'bg-purple-500/20 text-purple-300'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Toggle AI summary"
      >
        <Sparkles className="w-3 h-3" />
        <span className="hidden lg:inline">Summary</span>
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setPreference('collapseThreshold', prefs.collapseThreshold > 0 ? 0 : 8)}
        className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${
          prefs.collapseThreshold > 0
            ? 'bg-green-500/20 text-green-300'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Collapse unchanged blocks"
      >
        <ChevronsUpDown className="w-3 h-3" />
        <span className="hidden lg:inline">Collapse</span>
      </button>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* Jump buttons */}
      <button
        onClick={onJumpPrev}
        className="p-1 text-text-muted hover:text-text-secondary transition-colors"
        title="Previous change (k)"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onJumpNext}
        className="p-1 text-text-muted hover:text-text-secondary transition-colors"
        title="Next change (j)"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* Search */}
      <div className="flex items-center gap-1">
        <Search className="w-3 h-3 text-text-muted" />
        <input
          type="text"
          value={prefs.searchTerm}
          onChange={(e) => setPreference('searchTerm', e.target.value)}
          placeholder="Search..."
          className="w-24 px-1.5 py-0.5 bg-transparent border-b border-border-subtle text-[10px] text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent"
        />
      </div>

      {/* File type filter chips */}
      {fileExtensions.length > 1 && (
        <>
          <div className="w-px h-4 bg-border-subtle mx-1" />
          <div className="flex items-center gap-0.5">
            {fileExtensions.slice(0, 6).map(ext => {
              const active = prefs.fileTypeFilters.length === 0 || prefs.fileTypeFilters.includes(ext);
              return (
                <button
                  key={ext}
                  onClick={() => {
                    if (prefs.fileTypeFilters.length === 0) {
                      // First click: filter to just this type
                      setPreference('fileTypeFilters', [ext]);
                    } else if (prefs.fileTypeFilters.includes(ext)) {
                      const next = prefs.fileTypeFilters.filter(e => e !== ext);
                      setPreference('fileTypeFilters', next.length === 0 ? [] : next);
                    } else {
                      setPreference('fileTypeFilters', [...prefs.fileTypeFilters, ext]);
                    }
                  }}
                  className={`px-1 py-0.5 rounded text-[9px] transition-colors ${
                    active
                      ? 'bg-elevated text-text-secondary'
                      : 'text-text-muted/40 hover:text-text-muted'
                  }`}
                >
                  .{ext}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Change category legend */}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <div className="w-2 h-2 rounded-sm bg-amber-500/60" />
          <span className="text-[9px] text-text-muted">Logic</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-2 h-2 rounded-sm bg-blue-500/60" />
          <span className="text-[9px] text-text-muted">Naming</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-2 h-2 rounded-sm bg-gray-500/40" />
          <span className="text-[9px] text-text-muted">Format</span>
        </div>
      </div>
    </div>
  );
};
