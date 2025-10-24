/**
 * Main Application Component
 *
 * Integrates all features:
 * - Session management (left sidebar)
 * - Chat interface (main area)
 * - Settings panel (toggleable)
 * - Toast notifications (Sonner)
 */

import { ChatInterface } from '@/components/ChatInterface';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SessionList } from '@/components/SessionList';
import { SettingsDialog } from '@/components/Settings/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { RestClient } from '@/services/api/rest-client';
import { useSessionStore } from '@/stores/sessionStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useState } from 'react';

// Create clients
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

const restClient = new RestClient({
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000,
});

function AppContent() {
  const [showSettings, setShowSettings] = useState(false);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  return (
    <>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* Left Sidebar - Session List */}
        <div className="w-80 border-r flex flex-col h-full">
          <div className="p-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-semibold tracking-tight">Claude Code Manager</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <Separator />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <SessionList client={restClient} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <ChatInterface sessionId={activeSessionId} client={restClient} />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsDialog client={restClient} open={showSettings} onOpenChange={setShowSettings} />

      {/* Toast Notifications */}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
