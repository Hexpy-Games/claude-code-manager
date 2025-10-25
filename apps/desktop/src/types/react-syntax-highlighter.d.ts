/**
 * Type declarations for react-syntax-highlighter CJS imports
 * The @types package doesn't include declarations for /dist/cjs/* paths
 */

declare module 'react-syntax-highlighter/dist/cjs/light' {
  import { FC } from 'react';

  interface SyntaxHighlighterProps {
    children: string;
    language?: string;
    style?: any;
    customStyle?: any;
    codeTagProps?: any;
    [key: string]: any;
  }

  interface SyntaxHighlighterComponent extends FC<SyntaxHighlighterProps> {
    registerLanguage(name: string, language: any): void;
  }

  const SyntaxHighlighter: SyntaxHighlighterComponent;
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/cjs/languages/hljs/*' {
  const language: any;
  export default language;
}

declare module 'react-syntax-highlighter/dist/cjs/styles/hljs/*' {
  const style: any;
  export default style;
}
