/**
 * SessionItem Component
 *
 * Individual session item in the session list with dropdown menu
 * Uses shadcn/ui Item component for clean, simple list appearance
 */

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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
    <Item
      className={cn(
        "cursor-pointer transition-colors",
        isActive
          ? "bg-primary/10 hover:bg-primary/15"
          : "hover:bg-muted/50"
      )}
      size="sm"
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
      <ItemMedia variant="icon">
        <GitBranch className="h-4 w-4" />
      </ItemMedia>

      <ItemContent>
        <ItemTitle>{session.title}</ItemTitle>
        <ItemDescription title={session.rootDirectory}>
          {session.rootDirectory}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
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
      </ItemActions>
    </Item>
  );
}
