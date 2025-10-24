/**
 * SettingsDialog Component
 *
 * Modal dialog for settings management
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RestClient } from '@/services/api/rest-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface SettingsDialogProps {
  client: RestClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ client, open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient();
  const [model, setModel] = useState<string>('sonnet');
  const [theme, setTheme] = useState<string>('system');
  const [successMessage, setSuccessMessage] = useState('');

  const { isLoading, data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const settings = await client.getAllSettings();
      return settings;
    },
    enabled: open,
  });

  // Sync React Query data with local state
  useEffect(() => {
    if (settings) {
      const modelSetting = settings.find((s) => s.key === 'model');
      const themeSetting = settings.find((s) => s.key === 'theme');

      if (modelSetting) setModel(modelSetting.value);
      if (themeSetting) setTheme(themeSetting.value);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([client.setSetting('model', model), client.setSetting('theme', theme)]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        onOpenChange(false);
      }, 1500);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>Configure your application preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Key Info */}
          <div className="rounded-lg bg-muted/50 p-3 border border-border">
            <p className="text-sm text-muted-foreground">
              API key is managed by Claude Code CLI. Use{' '}
              <code className="bg-background/80 px-1.5 py-0.5 rounded text-xs font-mono border border-border">
                claude configure
              </code>{' '}
              to set it up.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model" className="text-sm font-medium">
              Model
            </Label>
            <Select value={model} onValueChange={setModel} disabled={isLoading || saveMutation.isPending}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sonnet">Claude Sonnet (Default)</SelectItem>
                <SelectItem value="opus">Claude Opus</SelectItem>
                <SelectItem value="haiku">Claude Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme Selection */}
          <div className="space-y-2">
            <Label htmlFor="theme" className="text-sm font-medium">
              Theme
            </Label>
            <Select value={theme} onValueChange={setTheme} disabled={isLoading || saveMutation.isPending}>
              <SelectTrigger id="theme">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
              {successMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
