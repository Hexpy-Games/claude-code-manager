/**
 * ToolCallDisplay Component
 *
 * Displays tool calls in messages
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ToolCallDisplayProps {
  // biome-ignore lint/suspicious/noExplicitAny: Tool calls have dynamic structure
  toolCalls: any[] | null;
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2">
      {toolCalls.map((toolCall) => (
        <Card key={toolCall.id} className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Tool Call</Badge>
              <span className="font-mono text-sm">{toolCall.function?.name || 'unknown'}</span>
            </div>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
              {toolCall.function?.arguments || '{}'}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
