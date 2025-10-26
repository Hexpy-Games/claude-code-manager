/**
 * SessionItem Component
 *
 * Individual session item in the session list with dropdown menu
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Session } from "@/services/api/types";
import { GitBranch, MoreVertical, Trash2 } from "lucide-react";
import type React from "react";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionItem({
  session,
  isActive,
  onSwitch,
  onDelete,
}: SessionItemProps) {
  const handleClick = () => {
    if (!isActive) {
      onSwitch(session.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.id);
  };

  return (
    <Card
      className={cn(
        "transition-all border-2 cursor-pointer",
        isActive
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-primary/30",
      )}
      onClick={handleClick}
      role="button"
      aria-label={isActive ? `${session.title}` : `Switch to ${session.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title and Badge Row */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-base truncate">
                {session.title}
              </h3>
            </div>

            {/* Directory Path */}
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <GitBranch className="h-3 w-3 inline shrink-0" />
              <span title={session.rootDirectory}>{session.rootDirectory}</span>
            </p>
          </div>

          {/* Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Delete session"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
