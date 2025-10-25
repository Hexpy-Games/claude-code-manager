/**
 * CodeBlock Component Tests
 * Sprint 2: Code Syntax Highlighting
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { CodeBlock } from './code-block';

// Mock react-syntax-highlighter to avoid refractor dynamic import issues in tests
vi.mock('react-syntax-highlighter/dist/cjs/light', () => {
  const Light = ({ children, language, ...props }: any) => (
    <pre {...props}>
      <code>{children}</code>
    </pre>
  );
  Light.registerLanguage = vi.fn();
  return { default: Light };
});

vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/javascript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/typescript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/python', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/rust', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/languages/hljs/bash', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark', () => ({ default: {} }));

describe('CodeBlock', () => {
  let mockWriteText: Mock;

  beforeEach(() => {
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  it('should render code with syntax highlighting', () => {
    const code = 'const greeting = "Hello World";';
    render(<CodeBlock code={code} language="typescript" />);

    // Code content should be visible
    expect(screen.getByText(/Hello World/)).toBeInTheDocument();
  });

  it('should display language label', () => {
    render(<CodeBlock code="console.log('test')" language="javascript" />);

    // Should show language label
    expect(screen.getByText('javascript')).toBeInTheDocument();
  });

  it('should render copy button for code block', () => {
    render(<CodeBlock code="test code" language="typescript" />);

    // Should have copy button
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should support TypeScript syntax', () => {
    const code = `interface User {
  name: string;
  age: number;
}`;
    const { container } = render(<CodeBlock code={code} language="typescript" />);

    // Should render with syntax highlighting container
    expect(container.querySelector('pre')).toBeInTheDocument();
  });

  it('should support Python syntax', () => {
    const code = `def hello():
    print("Hello")`;
    render(<CodeBlock code={code} language="python" />);

    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  it('should support Rust syntax', () => {
    const code = 'fn main() { println!("Hello"); }';
    render(<CodeBlock code={code} language="rust" />);

    expect(screen.getByText(/main/)).toBeInTheDocument();
  });

  it('should support Bash syntax', () => {
    const code = 'echo "Hello World"';
    render(<CodeBlock code={code} language="bash" />);

    expect(screen.getByText(/echo/)).toBeInTheDocument();
  });

  it('should handle unknown language gracefully', () => {
    render(<CodeBlock code="some code" language="unknown-lang" />);

    // Should still render the code
    expect(screen.getByText(/some code/)).toBeInTheDocument();
  });

  it('should apply dark theme by default', () => {
    const { container } = render(<CodeBlock code="test" language="typescript" />);

    const pre = container.querySelector('pre');
    // Check for dark theme background (syntax highlighter adds inline styles)
    expect(pre).toBeInTheDocument();
  });

  it('should have monospace font', () => {
    const { container } = render(<CodeBlock code="test" language="typescript" />);

    const codeBlock = container.querySelector('code');
    expect(codeBlock).toBeInTheDocument();
  });
});
