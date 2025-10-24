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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { RestClient } from '@/services/api/rest-client';
import { useSessionStore } from '@/stores/sessionStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { NewSessionDialog } from './NewSessionDialog';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  client: RestClient;
}

export function SessionList({ client }: SessionListProps) {
  const queryClient = useQueryClient();
  const { setSessions, setActiveSessionId } = useSessionStore();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Fetch sessions
  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sessions'],
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
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.deleteSession(id, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
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

  // Sort sessions by updatedAt descending
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Button onClick={() => setIsNewDialogOpen(true)} size="sm" aria-label="New Session">
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
      ) : sortedSessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p>No sessions yet</p>
            <p className="text-sm mt-2">Create your first session to get started</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {sortedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onSwitch={handleSwitch}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <NewSessionDialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen} client={client} />

      <AlertDialog open={deleteSessionId !== null} onOpenChange={handleDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
