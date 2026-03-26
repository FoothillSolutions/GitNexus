/** Structured diff result from the backend /api/diff endpoint. */

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface DiffSymbol {
  id: string;
  name: string;
  type: string;
  changeScope: 'directly_changed' | 'in_changed_file';
}

export interface DiffFile {
  filePath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  symbols: DiffSymbol[];
}

export interface DiffProcess {
  id: string;
  name: string;
  processType: string;
  stepCount: number;
  changedSteps: Array<{ symbol: string; step: number }>;
}

export interface DiffCommit {
  sha: string;
  message: string;
}

export interface DiffSummary {
  base: string;
  head: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  changedSymbolCount: number;
  affectedProcessCount: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface DiffResult {
  summary: DiffSummary;
  commits: DiffCommit[];
  files: DiffFile[];
  changedSymbols: Array<{
    id: string;
    name: string;
    type: string;
    filePath: string;
    changeScope: 'directly_changed' | 'in_changed_file';
  }>;
  affectedProcesses: DiffProcess[];
  error?: string;
}

export interface BranchesResult {
  branches: string[];
  tags: string[];
  currentBranch: string;
}
