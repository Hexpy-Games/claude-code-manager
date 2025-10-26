/**
 * Custom TitleBar Component
 *
 * Works with Tauri's overlay mode (titleBarStyle: "Overlay")
 * Native macOS traffic lights remain visible, we just style the title area
 */

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="h-9 bg-muted/80 flex items-center px-3 select-none shrink-0"
    >
      {/* Left padding to avoid traffic lights (positioned at x:15, y:20) */}
      <div className="w-[70px]" />

      {/* Title - Centered */}
      <div
        data-tauri-drag-region
        className="flex-1 text-center text-sm font-medium text-foreground"
      >
        Claude Code Manager
      </div>

      {/* Right padding for symmetry */}
      <div className="w-[70px]" />
    </div>
  );
}
