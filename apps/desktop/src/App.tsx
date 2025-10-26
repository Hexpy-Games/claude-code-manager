/**
 * Main Application Component
 *
 * Integrates all features:
 * - Session management (left sidebar)
 * - Chat interface (main area)
 * - Settings panel (toggleable)
 * - Toast notifications (Sonner)
 * - Global keyboard shortcuts
 */

import { ChatInterface } from "@/components/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionList } from "@/components/SessionList";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { TitleBar } from "@/components/TitleBar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { RestClient } from "@/services/api/rest-client";
import { useSessionStore } from "@/stores/sessionStore";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useHotkeys } from "react-hotkeys-hook";

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
  baseUrl: "http://localhost:3000/api",
  timeout: 120000, // 2 minutes - longer timeout for streaming operations
});

function AppContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSessionId = useSessionStore(
    (state) => state.setActiveSessionId,
  );

  // Fetch sessions for keyboard shortcuts (Cmd+1-9)
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => restClient.listSessions(),
  });

  // Global Keyboard Shortcuts

  // Cmd/Ctrl+, - Open settings
  useHotkeys(
    "mod+comma",
    (e) => {
      e.preventDefault();
      setShowSettings(true);
    },
    { enableOnFormTags: true },
  );

  // Cmd/Ctrl+N - New session
  useHotkeys(
    "mod+n",
    (e) => {
      e.preventDefault();
      setShowNewSessionDialog(true);
    },
    { enableOnFormTags: true },
  );

  // Cmd/Ctrl+W - Close/deselect active session
  useHotkeys(
    "mod+w",
    (e) => {
      e.preventDefault();
      if (activeSessionId) {
        setActiveSessionId(null);
      }
    },
    { enableOnFormTags: true },
  );

  // Cmd/Ctrl+1-9 - Switch to session by number
  useHotkeys(
    "mod+1, mod+2, mod+3, mod+4, mod+5, mod+6, mod+7, mod+8, mod+9",
    (e, handler) => {
      e.preventDefault();

      // Extract the number from the pressed key
      const pressedKey = handler.keys?.[0];
      if (!pressedKey) return;

      const sessionIndex = Number(pressedKey) - 1;
      const targetSession = sessions[sessionIndex];

      if (targetSession) {
        setActiveSessionId(targetSession.id);
      }
    },
    { enableOnFormTags: true },
    [sessions],
  );

  return (
    <>
      <div className="h-screen bg-muted/80 overflow-hidden flex flex-col">
        {/* Custom TitleBar with native macOS traffic lights */}
        <TitleBar />

        {/* Main Content */}
        <div className="flex-1 min-h-0">
          <PanelGroup direction="horizontal" id="main-layout">
            {/* Left Sidebar - Session List (Resizable) */}
            <Panel
              defaultSize={25}
              minSize={15}
              maxSize={40}
              id="session-panel"
            >
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto min-h-0">
                  <SessionList
                    client={restClient}
                    isNewDialogOpen={showNewSessionDialog}
                    onNewDialogOpenChange={setShowNewSessionDialog}
                  />
                </div>
                <div className="p-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                      aria-label="Open settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1px bg-transparent hover:bg-primary/50 transition-colors" />

            {/* Main Content Area (Resizable) */}
            <Panel defaultSize={75} minSize={50} id="main-panel">
              <div className="bg-background flex flex-col h-full min-w-0 rounded-tl-lg">
                <ChatInterface
                  sessionId={activeSessionId}
                  client={restClient}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsDialog
        client={restClient}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

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
