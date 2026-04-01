import { diffWords } from 'diff';
import type { DiffFile, DiffHunk, DiffSymbol } from '../types/diff';

// ── Change Classification ────────────────────────────────────────────────

export type ChangeCategory = 'logic' | 'naming' | 'formatting';

export const CHANGE_CATEGORY_COLORS = {
  logic:      { bg: 'bg-amber-900/15', text: 'text-amber-300', border: 'border-l-amber-500/60' },
  naming:     { bg: 'bg-blue-900/15',  text: 'text-blue-300',  border: 'border-l-blue-500/60' },
  formatting: { bg: 'bg-gray-900/10',  text: 'text-gray-400',  border: 'border-l-gray-500/30' },
} as const;

/** Normalize whitespace for comparison */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Extract identifiers from a line of code */
function extractIdentifiers(s: string): string[] {
  return (s.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || []);
}

/** Extract structural tokens (operators, keywords, brackets) */
function extractStructure(s: string): string {
  return s.replace(/[a-zA-Z_$][a-zA-Z0-9_$]*/g, '_').replace(/\s+/g, '');
}

/**
 * Classify the type of change between two paired lines.
 */
export function classifyLineChange(oldLine: string, newLine: string): ChangeCategory {
  // Pure whitespace/formatting change
  if (normalizeWhitespace(oldLine) === normalizeWhitespace(newLine)) {
    return 'formatting';
  }

  // Check if only identifiers changed (same structure)
  const oldStruct = extractStructure(oldLine);
  const newStruct = extractStructure(newLine);
  if (oldStruct === newStruct) {
    // Same operators/structure, different identifiers → naming change
    return 'naming';
  }

  // Everything else is a logic change
  return 'logic';
}

/**
 * Check if a line pair is a formatting-only change.
 */
export function isFormattingOnlyChange(oldLine: string, newLine: string): boolean {
  return normalizeWhitespace(oldLine) === normalizeWhitespace(newLine);
}

// ── Word-Level Diffing ───────────────────────────────────────────────────

export interface DiffSegment {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

/**
 * Compute word-level diff between two lines.
 */
export function computeWordDiff(oldLine: string, newLine: string): {
  oldSegments: DiffSegment[];
  newSegments: DiffSegment[];
} {
  const changes = diffWords(oldLine, newLine);
  const oldSegments: DiffSegment[] = [];
  const newSegments: DiffSegment[] = [];

  for (const change of changes) {
    if (change.added) {
      newSegments.push({ text: change.value, type: 'added' });
    } else if (change.removed) {
      oldSegments.push({ text: change.value, type: 'removed' });
    } else {
      oldSegments.push({ text: change.value, type: 'unchanged' });
      newSegments.push({ text: change.value, type: 'unchanged' });
    }
  }

  return { oldSegments, newSegments };
}

// ── Line Pairing ─────────────────────────────────────────────────────────

export interface PairedLine {
  type: 'paired' | 'added' | 'removed' | 'context';
  oldLine?: string;
  newLine?: string;
  oldNum?: number;
  newNum?: number;
  category?: ChangeCategory;
}

/**
 * Pair consecutive removed/added lines for word-level comparison.
 * Unpaired lines remain standalone.
 */
export function pairHunkLines(hunk: DiffHunk): PairedLine[] {
  const result: PairedLine[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const lines = hunk.lines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const type = line[0];

    if (type === ' ') {
      result.push({
        type: 'context',
        oldLine: line.substring(1),
        newLine: line.substring(1),
        oldNum: oldLine++,
        newNum: newLine++,
      });
      i++;
    } else if (type === '-') {
      // Collect consecutive removed lines
      const removedStart = i;
      const removedLines: { content: string; num: number }[] = [];
      while (i < lines.length && lines[i][0] === '-') {
        removedLines.push({ content: lines[i].substring(1), num: oldLine++ });
        i++;
      }
      // Collect consecutive added lines
      const addedLines: { content: string; num: number }[] = [];
      while (i < lines.length && lines[i][0] === '+') {
        addedLines.push({ content: lines[i].substring(1), num: newLine++ });
        i++;
      }

      // Pair them up
      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < maxLen; j++) {
        const removed = removedLines[j];
        const added = addedLines[j];

        if (removed && added) {
          result.push({
            type: 'paired',
            oldLine: removed.content,
            newLine: added.content,
            oldNum: removed.num,
            newNum: added.num,
            category: classifyLineChange(removed.content, added.content),
          });
        } else if (removed) {
          result.push({ type: 'removed', oldLine: removed.content, oldNum: removed.num });
        } else if (added) {
          result.push({ type: 'added', newLine: added.content, newNum: added.num });
        }
      }
    } else if (type === '+') {
      result.push({ type: 'added', newLine: line.substring(1), newNum: newLine++ });
      i++;
    } else {
      i++;
    }
  }

  return result;
}

// ── Context Collapsing ───────────────────────────────────────────────────

export interface CollapsibleRange {
  startIdx: number;
  endIdx: number;
  lineCount: number;
}

/**
 * Find ranges of consecutive context lines that can be collapsed.
 */
export function findCollapsibleRanges(pairedLines: PairedLine[], threshold: number): CollapsibleRange[] {
  if (threshold <= 0) return [];
  const ranges: CollapsibleRange[] = [];
  let runStart = -1;
  let runLength = 0;

  for (let i = 0; i <= pairedLines.length; i++) {
    const isContext = i < pairedLines.length && pairedLines[i].type === 'context';
    if (isContext) {
      if (runStart === -1) runStart = i;
      runLength++;
    } else {
      if (runLength > threshold) {
        // Keep first 3 and last 3 lines visible
        const start = runStart + 3;
        const end = runStart + runLength - 3;
        if (start < end) {
          ranges.push({ startIdx: start, endIdx: end, lineCount: end - start });
        }
      }
      runStart = -1;
      runLength = 0;
    }
  }

  return ranges;
}

// ── Symbol Grouping ──────────────────────────────────────────────────────

export interface SymbolGroup {
  symbol: DiffSymbol | null; // null = "Other Changes"
  hunks: DiffHunk[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Group hunks by the symbol they belong to.
 * Uses hunk header function name hints and symbol name matching.
 */
export function groupHunksBySymbol(hunks: DiffHunk[], symbols: DiffSymbol[]): SymbolGroup[] {
  if (symbols.length === 0) {
    const totals = hunks.reduce((acc, h) => ({
      add: acc.add + h.lines.filter(l => l[0] === '+').length,
      del: acc.del + h.lines.filter(l => l[0] === '-').length,
    }), { add: 0, del: 0 });
    return [{ symbol: null, hunks, totalAdditions: totals.add, totalDeletions: totals.del }];
  }

  const groups = new Map<string, { symbol: DiffSymbol; hunks: DiffHunk[] }>();
  const ungrouped: DiffHunk[] = [];

  for (const hunk of hunks) {
    // Search hunk content for symbol names
    const hunkText = hunk.lines.join('\n');
    let matched = false;

    for (const sym of symbols) {
      if (hunkText.includes(sym.name)) {
        const key = sym.id;
        if (!groups.has(key)) {
          groups.set(key, { symbol: sym, hunks: [] });
        }
        groups.get(key)!.hunks.push(hunk);
        matched = true;
        break;
      }
    }

    if (!matched) ungrouped.push(hunk);
  }

  const result: SymbolGroup[] = [];
  for (const [, group] of groups) {
    const totals = group.hunks.reduce((acc, h) => ({
      add: acc.add + h.lines.filter(l => l[0] === '+').length,
      del: acc.del + h.lines.filter(l => l[0] === '-').length,
    }), { add: 0, del: 0 });
    result.push({ symbol: group.symbol, hunks: group.hunks, totalAdditions: totals.add, totalDeletions: totals.del });
  }

  if (ungrouped.length > 0) {
    const totals = ungrouped.reduce((acc, h) => ({
      add: acc.add + h.lines.filter(l => l[0] === '+').length,
      del: acc.del + h.lines.filter(l => l[0] === '-').length,
    }), { add: 0, del: 0 });
    result.push({ symbol: null, hunks: ungrouped, totalAdditions: totals.add, totalDeletions: totals.del });
  }

  return result;
}

// ── AI Summary Generation (Heuristic) ────────────────────────────────────

import type { DiffResult } from '../types/diff';

export interface DiffInsight {
  tldr: string;
  riskExplanation: string;
  fileSummaries: Array<{ filePath: string; summary: string }>;
}

// ── Risk Categorization ──────────────────────────────────────────────────

export type RiskCategory = 'core-logic' | 'wide-impact' | 'refactor' | 'breaking' | 'config' | 'ui-only';

export interface RiskChip {
  category: RiskCategory;
  label: string;
  color: string;
  bgColor: string;
  matchingFiles: string[];
}

const CONFIG_EXTS = new Set(['json', 'yaml', 'yml', 'toml', 'env', 'ini', 'cfg']);
const UI_EXTS = new Set(['tsx', 'jsx', 'css', 'scss', 'sass', 'less', 'html', 'svg']);
const DOC_EXTS = new Set(['md', 'mdx', 'txt', 'rst']);

export function categorizeRisks(data: DiffResult): RiskChip[] {
  const chips: RiskChip[] = [];
  const { changedSymbols, affectedProcesses, files } = data;

  // Core logic: directly changed symbols in processes
  const coreFiles = files.filter(f =>
    f.symbols.some(s => s.changeScope === 'directly_changed') &&
    !CONFIG_EXTS.has(f.filePath.split('.').pop()?.toLowerCase() || '') &&
    !UI_EXTS.has(f.filePath.split('.').pop()?.toLowerCase() || '')
  );
  if (coreFiles.length > 0) {
    chips.push({ category: 'core-logic', label: 'Core Logic', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', matchingFiles: coreFiles.map(f => f.filePath) });
  }

  // Wide impact
  if (affectedProcesses.length > 5) {
    chips.push({ category: 'wide-impact', label: `Wide Impact (${affectedProcesses.length} flows)`, color: '#f97316', bgColor: 'rgba(249,115,22,0.15)', matchingFiles: [] });
  }

  // Refactor: many in_changed_file symbols
  const inFileOnly = changedSymbols.filter(s => s.changeScope === 'in_changed_file');
  if (inFileOnly.length > changedSymbols.length * 0.5 && changedSymbols.length > 5) {
    chips.push({ category: 'refactor', label: 'Refactor', color: '#a78bfa', bgColor: 'rgba(167,139,250,0.15)', matchingFiles: [] });
  }

  // Breaking: Class/Interface changes
  const breakingSyms = changedSymbols.filter(s =>
    s.changeScope === 'directly_changed' && ['Class', 'Interface', 'Struct', 'Trait'].includes(s.type || '')
  );
  if (breakingSyms.length > 0) {
    chips.push({ category: 'breaking', label: 'Breaking', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', matchingFiles: breakingSyms.map(s => s.filePath) });
  }

  // Config only
  const configFiles = files.filter(f => CONFIG_EXTS.has(f.filePath.split('.').pop()?.toLowerCase() || ''));
  if (configFiles.length > 0) {
    chips.push({ category: 'config', label: 'Config', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)', matchingFiles: configFiles.map(f => f.filePath) });
  }

  // UI only
  const uiFiles = files.filter(f => UI_EXTS.has(f.filePath.split('.').pop()?.toLowerCase() || ''));
  if (uiFiles.length > 0 && uiFiles.length === files.length) {
    chips.push({ category: 'ui-only', label: 'UI Only', color: '#ec4899', bgColor: 'rgba(236,72,153,0.15)', matchingFiles: uiFiles.map(f => f.filePath) });
  }

  return chips;
}

// ── File & Hunk Intent ───────────────────────────────────────────────────

export function generateFileIntent(file: DiffFile): string {
  if (file.status === 'added') return 'New file';
  if (file.status === 'deleted') return 'Removed';
  if (file.status === 'renamed') return 'Renamed/moved';

  const directs = file.symbols.filter(s => s.changeScope === 'directly_changed');
  if (directs.length === 0) return `${file.additions} additions, ${file.deletions} deletions`;

  const types = new Set(directs.map(s => s.type?.toLowerCase()).filter(Boolean));
  const names = directs.slice(0, 2).map(s => s.name);

  if (types.has('class') || types.has('interface')) {
    return `Modifies ${names.join(', ')}${directs.length > 2 ? ` +${directs.length - 2}` : ''}`;
  }
  if (types.has('function') || types.has('method')) {
    return `Updates ${names.join(', ')}${directs.length > 2 ? ` +${directs.length - 2}` : ''}`;
  }
  return `Changes ${directs.length} symbol${directs.length > 1 ? 's' : ''}`;
}

export function classifyHunkIntent(hunk: DiffHunk): string | null {
  const added = hunk.lines.filter(l => l[0] === '+').map(l => l.substring(1));
  const removed = hunk.lines.filter(l => l[0] === '-').map(l => l.substring(1));

  // Import change
  if (added.some(l => /^\s*(import|from|require)/.test(l)) || removed.some(l => /^\s*(import|from|require)/.test(l))) {
    return 'Import change';
  }
  // Class/interface definition
  if (added.some(l => /^\s*(class|interface|struct|trait|enum)\s/.test(l)) || removed.some(l => /^\s*(class|interface|struct|trait|enum)\s/.test(l))) {
    return 'Type definition change';
  }
  // Function signature
  if (added.some(l => /^\s*(function|def|fn|func|async|export)\s/.test(l)) || removed.some(l => /^\s*(function|def|fn|func|async|export)\s/.test(l))) {
    return 'Function signature change';
  }
  // Return statement
  if (added.some(l => /^\s*return\s/.test(l)) || removed.some(l => /^\s*return\s/.test(l))) {
    return 'Return value change';
  }
  return null;
}

export function generateDiffInsight(data: DiffResult): DiffInsight {
  const { summary, changedSymbols, affectedProcesses, files } = data;

  // Count symbol types
  const typeCounts = new Map<string, number>();
  for (const sym of changedSymbols) {
    const t = sym.type || 'unknown';
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  const typeBreakdown = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${type.toLowerCase()}${count > 1 ? 's' : ''}`)
    .join(', ');

  // Top affected processes
  const topProcesses = affectedProcesses
    .slice(0, 3)
    .map(p => p.name)
    .join(', ');

  // Detect patterns
  const directlyChanged = changedSymbols.filter(s => s.changeScope === 'directly_changed');
  const inFile = changedSymbols.filter(s => s.changeScope === 'in_changed_file');
  const isRefactor = inFile.length > directlyChanged.length * 2;

  // TL;DR
  let tldr = `Modifies ${typeBreakdown || `${summary.changedSymbolCount} symbols`} across ${summary.changedFiles} file${summary.changedFiles !== 1 ? 's' : ''}.`;
  if (isRefactor) tldr += ' Appears to be a broad refactor.';
  if (topProcesses) tldr += ` Affects: ${topProcesses}.`;

  // Risk explanation
  const riskExplanation = summary.riskLevel === 'critical'
    ? `Critical risk: ${summary.affectedProcessCount} execution flows impacted. Review all affected processes carefully.`
    : summary.riskLevel === 'high'
    ? `High risk: changes touch ${directlyChanged.length} symbols with ${summary.affectedProcessCount} downstream processes.`
    : summary.riskLevel === 'medium'
    ? `Medium risk: ${summary.changedSymbolCount} symbols changed, ${summary.affectedProcessCount} processes affected.`
    : `Low risk: limited scope with ${summary.changedSymbolCount} symbol${summary.changedSymbolCount !== 1 ? 's' : ''} changed.`;

  // Per-file summaries
  const fileSummaries = files.slice(0, 10).map(f => {
    const symNames = f.symbols
      .filter(s => s.changeScope === 'directly_changed')
      .map(s => s.name)
      .slice(0, 3);
    const parts: string[] = [];
    if (f.status === 'added') parts.push('New file');
    else if (f.status === 'deleted') parts.push('Deleted');
    else if (f.status === 'renamed') parts.push('Renamed');
    if (symNames.length > 0) parts.push(symNames.join(', '));
    else parts.push(`+${f.additions}/-${f.deletions}`);
    return { filePath: f.filePath, summary: parts.join(' — ') };
  });

  return { tldr, riskExplanation, fileSummaries };
}
