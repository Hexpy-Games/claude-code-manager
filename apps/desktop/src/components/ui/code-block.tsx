/**
 * CodeBlock Component
 *
 * Displays code with syntax highlighting and copy button
 */

import { CopyButton } from '@/components/ui/copy-button';
// Use CJS imports to avoid Vite bundling issues with refractor
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import bash from 'react-syntax-highlighter/dist/cjs/languages/hljs/bash';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/hljs/javascript';
import python from 'react-syntax-highlighter/dist/cjs/languages/hljs/python';
import rust from 'react-syntax-highlighter/dist/cjs/languages/hljs/rust';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/hljs/typescript';
import atomOneDark from 'react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('bash', bash);

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-border">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
        <CopyButton content={code} />
      </div>

      {/* Code with syntax highlighting */}
      <SyntaxHighlighter
        language={language}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
          lineHeight: '1.5',
          background: 'rgb(40, 44, 52)', // Unified background color from atom-one-dark
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            background: 'transparent', // Remove per-line backgrounds
          },
        }}
        lineNumberContainerStyle={{
          background: 'transparent', // Remove line number background
        }}
        lineProps={{
          style: {
            background: 'transparent', // Remove per-line background styling
            display: 'block',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
