/**
 * ToolCallDisplay Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolCallDisplay } from './ToolCallDisplay';

describe('ToolCallDisplay', () => {
  const mockToolCalls = [
    {
      id: 'tool_1',
      type: 'function',
      function: {
        name: 'read_file',
        arguments: '{"path": "/test/file.txt"}',
      },
    },
  ];

  it('should render tool call name', () => {
    render(<ToolCallDisplay toolCalls={mockToolCalls} />);
    expect(screen.getByText(/read_file/i)).toBeInTheDocument();
  });

  it('should render tool call arguments', () => {
    render(<ToolCallDisplay toolCalls={mockToolCalls} />);
    expect(screen.getByText(/path/)).toBeInTheDocument();
  });

  it('should render multiple tool calls', () => {
    const multipleTools = [
      ...mockToolCalls,
      {
        id: 'tool_2',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: '{"path": "/test/output.txt"}',
        },
      },
    ];

    render(<ToolCallDisplay toolCalls={multipleTools} />);
    expect(screen.getByText(/read_file/i)).toBeInTheDocument();
    expect(screen.getByText(/write_file/i)).toBeInTheDocument();
  });

  it('should render nothing if toolCalls is empty', () => {
    const { container } = render(<ToolCallDisplay toolCalls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing if toolCalls is null', () => {
    const { container } = render(<ToolCallDisplay toolCalls={null} />);
    expect(container.firstChild).toBeNull();
  });
});
