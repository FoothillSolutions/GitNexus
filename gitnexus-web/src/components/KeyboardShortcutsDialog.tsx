import { X } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['['], description: 'Previous file' },
      { keys: [']'], description: 'Next file' },
      { keys: ['j'], description: 'Next hunk' },
      { keys: ['k'], description: 'Previous hunk' },
    ],
  },
  {
    title: 'View Modes',
    shortcuts: [
      { keys: ['1'], description: 'Focus mode (diff only)' },
      { keys: ['2'], description: 'Structure mode (graph + stats)' },
      { keys: ['3'], description: 'Review mode (graph + diff)' },
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      { keys: ['f'], description: 'Toggle file list' },
      { keys: ['Escape'], description: 'Exit diff mode / close panels' },
    ],
  },
  {
    title: 'Help',
    shortcuts: [
      { keys: ['?'], description: 'Show this dialog' },
    ],
  },
];

export const KeyboardShortcutsDialog = ({ isOpen, onClose }: KeyboardShortcutsDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-deep border border-border-subtle rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {SHORTCUT_SECTIONS.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{section.title}</h3>
              <div className="space-y-1.5">
                {section.shortcuts.map(shortcut => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map(key => (
                        <kbd
                          key={key}
                          className="px-2 py-0.5 bg-elevated border border-border-subtle rounded text-[11px] font-mono text-text-primary min-w-[24px] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle/50 text-center">
          <span className="text-[10px] text-text-muted">Press <kbd className="px-1 py-0 bg-elevated border border-border-subtle rounded text-[10px] font-mono">Escape</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
