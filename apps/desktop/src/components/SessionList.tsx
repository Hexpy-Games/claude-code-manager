/**
 * SessionList Component
 *
 * Main session list container with create, switch, and delete functionality
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { RestClient } from "@/services/api/rest-client";
import { useSessionStore } from "@/stores/sessionStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import { useRef, useState, useMemo } from "react";
import { NewSessionDialog } from "./NewSessionDialog";
import { SessionItem } from "./SessionItem";

interface SessionListProps {
  client: RestClient;
  isNewDialogOpen?: boolean;
  onNewDialogOpenChange?: (open: boolean) => void;
}

export function SessionList({
  client,
  isNewDialogOpen: externalIsNewDialogOpen,
  onNewDialogOpenChange: externalOnNewDialogOpenChange,
}: SessionListProps) {
  const queryClient = useQueryClient();
  const { setSessions, setActiveSessionId, activeSessionId } =
    useSessionStore();

  // Use external state if provided, otherwise use local state
  const [localIsNewDialogOpen, setLocalIsNewDialogOpen] = useState(false);
  const isNewDialogOpen = externalIsNewDialogOpen ?? localIsNewDialogOpen;
  const setIsNewDialogOpen =
    externalOnNewDialogOpenChange ?? setLocalIsNewDialogOpen;

  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch sessions
  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const data = await client.listSessions();
      setSessions(data);
      const activeSession = data.find((s) => s.isActive);
      if (activeSession) {
        setActiveSessionId(activeSession.id);
      }
      return data;
    },
  });

  // Switch session mutation
  const switchMutation = useMutation({
    mutationFn: (id: string) => client.switchSession(id),
    onSuccess: (session) => {
      setActiveSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.deleteSession(id, false),
    onSuccess: (_, deletedSessionId) => {
      // If deleted session was active, clear active session
      if (deletedSessionId === activeSessionId) {
        setActiveSessionId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setDeleteSessionId(null);
    },
  });

  const handleSwitch = (id: string) => {
    switchMutation.mutate(id);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteSessionId(id);
  };

  const handleDeleteConfirm = () => {
    if (deleteSessionId) {
      deleteMutation.mutate(deleteSessionId);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteSessionId(null);
  };

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated height of each SessionItem (~84px + 16px gap from mb-4)
    overscan: 5, // Render 5 extra items above and below viewport
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Button
            onClick={() => setIsNewDialogOpen(true)}
            size="sm"
            aria-label="New Session"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
        <Separator />
      </div>

      {isLoading ? (
        <div className="p-3 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <div className="p-4 text-center text-destructive">
          <p>Error loading sessions</p>
          <p className="text-sm">{String(error)}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p>No sessions yet</p>
            <p className="text-sm mt-2">
              Create your first session to get started
            </p>
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const session = sessions[virtualRow.index];
              return (
                <div
                  key={session.id}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    padding: "0 12px",
                  }}
                >
                  <div className="mb-4">
                    <SessionItem
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSwitch={handleSwitch}
                      onDelete={handleDeleteClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NewSessionDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        client={client}
      />

      <AlertDialog
        open={deleteSessionId !== null}
        onOpenChange={handleDeleteCancel}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
