/**
 * App Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Mock API client
vi.mock('@/services/api/rest-client', () => ({
  RestClient: class {
    listSessions = vi.fn().mockResolvedValue([]);
    getMessages = vi.fn().mockResolvedValue([]);
    getAllSettings = vi.fn().mockResolvedValue([]);
  },
}));

describe('App', () => {
  it('should render the app title', () => {
    render(<App />);
    expect(screen.getByText('Claude Code Manager')).toBeInTheDocument();
  });

  it('should render Settings button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('should render within ErrorBoundary', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });

  it('should have QueryClientProvider', () => {
    const { container } = render(<App />);
    expect(container.querySelector('div')).toBeInTheDocument();
  });
});
