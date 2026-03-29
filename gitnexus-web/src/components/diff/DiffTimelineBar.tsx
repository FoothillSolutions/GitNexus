import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, GitCommitHorizontal } from 'lucide-react';
import type { DiffCommit } from '../../types/diff';

interface DiffTimelineBarProps {
  commits: DiffCommit[];
  activeCommit: string | null;
  onSelectCommit: (sha: string) => void;
  onShowAll: () => void;
}

export const DiffTimelineBar = ({ commits, activeCommit, onSelectCommit, onShowAll }: DiffTimelineBarProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const currentIdxRef = useRef(0);

  // Stop playing on unmount or when commits change
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [commits]);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    currentIdxRef.current = activeCommit
      ? commits.findIndex(c => c.sha === activeCommit)
      : -1;

    intervalRef.current = window.setInterval(() => {
      currentIdxRef.current++;
      if (currentIdxRef.current >= commits.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPlaying(false);
        return;
      }
      onSelectCommit(commits[currentIdxRef.current].sha);
    }, 2000);
  }, [isPlaying, activeCommit, commits, onSelectCommit]);

  if (commits.length === 0) return null;

  return (
    <div className="relative flex-shrink-0 border-b border-border-subtle bg-surface/30">
    <div className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto scrollbar-thin">
      {/* Play button */}
      <button
        onClick={handlePlay}
        className="p-1 rounded hover:bg-hover transition-colors text-text-muted hover:text-text-primary flex-shrink-0"
        title={isPlaying ? 'Pause' : 'Play through commits'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      {/* "All" button */}
      <button
        onClick={onShowAll}
        className={`px-1.5 py-0.5 rounded text-[10px] transition-colors flex-shrink-0 ${
          !activeCommit
            ? 'bg-amber-500/20 text-amber-300'
            : 'text-text-muted hover:text-text-secondary hover:bg-hover'
        }`}
      >
        All
      </button>

      {/* Commit dots */}
      <div className="flex items-center gap-0.5">
        {commits.map((commit, idx) => {
          const isActive = commit.sha === activeCommit;
          return (
            <button
              key={commit.sha}
              onClick={() => onSelectCommit(commit.sha)}
              onMouseEnter={() => setHoveredCommit(commit.message)}
              onMouseLeave={() => setHoveredCommit(null)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-text-muted hover:text-text-secondary hover:bg-hover'
              }`}
              title={commit.message}
            >
              <GitCommitHorizontal className="w-3 h-3" />
              <span className="text-[9px] font-mono">{commit.sha.substring(0, 7)}</span>
            </button>
          );
        })}
      </div>
    </div>
    {/* Floating tooltip rendered outside scroll container */}
    {hoveredCommit && (
      <div
        className="absolute left-0 right-0 top-0 -translate-y-full px-2 py-1 pointer-events-none z-50"
      >
        <div className="mx-auto w-fit max-w-64 px-2 py-1 bg-elevated border border-border-subtle rounded text-[10px] text-text-primary truncate shadow-lg">
          {hoveredCommit}
        </div>
      </div>
    )}
    </div>
  );
};
