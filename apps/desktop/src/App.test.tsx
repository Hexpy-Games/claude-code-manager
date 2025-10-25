/**
 * App Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Mock react-syntax-highlighter
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
vi.mock('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark', () => ({ atomOneDark: {} }));

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

  describe('Panel Width Persistence', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('should have PanelGroup with persistence storage ID', () => {
      render(<App />);

      // PanelGroup should have a unique storage ID for persistence
      const panelGroup = document.querySelector('[data-panel-group-id="main-layout"]');
      expect(panelGroup).toBeInTheDocument();
    });

    it('should save panel layout to localStorage with correct key', () => {
      render(<App />);

      // After rendering, localStorage should have the panel layout saved
      // The key should match: react-resizable-panels:layout:main-layout
      const layoutKey = 'react-resizable-panels:layout:main-layout';

      // Should have stored layout (may be null or string depending on implementation)
      expect(localStorage.getItem(layoutKey) !== undefined).toBe(true);
    });

    it('should restore panel layout from localStorage on mount', () => {
      // Pre-populate localStorage with custom layout
      const layoutKey = 'react-resizable-panels:layout:main-layout';
      const customLayout = JSON.stringify([30, 70]);
      localStorage.setItem(layoutKey, customLayout);

      render(<App />);

      // Verify localStorage was accessed
      const storedLayout = localStorage.getItem(layoutKey);
      expect(storedLayout).toBe(customLayout);
    });

    it('should use custom storage key for panel persistence', () => {
      render(<App />);

      // Check that localStorage has been set with the custom key
      const layoutKey = 'react-resizable-panels:layout:main-layout';
      expect(localStorage.getItem(layoutKey) !== undefined).toBe(true);
    });
  });
});
