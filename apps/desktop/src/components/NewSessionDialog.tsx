/**
 * NewSessionDialog Component
 *
 * Modal dialog for creating new sessions
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RestClient } from '@/services/api/rest-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: RestClient;
}

interface FormErrors {
  title?: string;
  rootDirectory?: string;
  general?: string;
}

export function NewSessionDialog({ open, onOpenChange, client }: NewSessionDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [rootDirectory, setRootDirectory] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const createMutation = useMutation({
    mutationFn: () =>
      client.createSession({
        title,
        rootDirectory,
        baseBranch: baseBranch || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      setErrors({ general: String(error) });
    },
  });

  const resetForm = () => {
    setTitle('');
    setRootDirectory('');
    setBaseBranch('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!rootDirectory.trim()) {
      newErrors.rootDirectory = 'Root directory is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      createMutation.mutate();
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>Create a new conversation session</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Session"
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rootDirectory">Root Directory</Label>
            <Input
              id="rootDirectory"
              value={rootDirectory}
              onChange={(e) => setRootDirectory(e.target.value)}
              placeholder="/path/to/project"
              aria-invalid={!!errors.rootDirectory}
            />
            {errors.rootDirectory && (
              <p className="text-sm text-destructive">{errors.rootDirectory}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseBranch">Base Branch (optional)</Label>
            <Input
              id="baseBranch"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              placeholder="main"
            />
          </div>

          {errors.general && <div className="text-sm text-destructive">{errors.general}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
