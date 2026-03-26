import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/** Map file extension to Prism syntax highlighter language identifier */
export const getSyntaxLanguage = (filePath: string | undefined): string => {
  if (!filePath) return 'text';
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': case 'mjs': case 'cjs': return 'javascript';
    case 'ts': case 'tsx': case 'mts': case 'cts': return 'typescript';
    case 'py': case 'pyw': return 'python';
    case 'rb': case 'rake': case 'gemspec': return 'ruby';
    case 'java': return 'java';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'c': case 'h': return 'c';
    case 'cpp': case 'cc': case 'cxx': case 'hpp': case 'hxx': case 'hh': return 'cpp';
    case 'cs': return 'csharp';
    case 'php': return 'php';
    case 'kt': case 'kts': return 'kotlin';
    case 'swift': return 'swift';
    case 'json': return 'json';
    case 'yaml': case 'yml': return 'yaml';
    case 'md': case 'mdx': return 'markdown';
    case 'html': case 'htm': case 'erb': return 'markup';
    case 'css': case 'scss': case 'sass': return 'css';
    case 'sh': case 'bash': case 'zsh': return 'bash';
    case 'sql': return 'sql';
    case 'xml': return 'xml';
    default: break;
  }
  // Handle extensionless files
  const basename = filePath.split('/').pop() || '';
  if (['Rakefile', 'Gemfile', 'Guardfile', 'Vagrantfile', 'Brewfile'].includes(basename)) return 'ruby';
  if (['Makefile'].includes(basename)) return 'makefile';
  if (['Dockerfile'].includes(basename)) return 'docker';
  return 'text';
};

/** Custom dark theme for code display */
export const customCodeTheme = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: '#0a0a10',
    margin: 0,
    padding: '12px 0',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'transparent',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
};
