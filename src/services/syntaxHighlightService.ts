import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';

export function getLanguageFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
      return 'markup';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'javascript';
  }
}

export function highlightCode(code: string, language: string): string {
  try {
    const grammar = Prism.languages[language] || Prism.languages.javascript;
    if (grammar) {
      return Prism.highlight(code, grammar, language);
    }
  } catch (e) {
    console.warn('Prism highlighting fallback:', e);
  }
  return code;
}
