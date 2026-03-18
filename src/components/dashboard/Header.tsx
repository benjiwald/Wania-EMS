"use client";
import { Activity, Bell, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";

export default function Header({ alertCount, userEmail }: { alertCount: number; userEmail?: string }) {
  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-foreground">
              WANIA <span className="text-primary">EMS</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full border border-border">
              v1.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {alertCount}
              </span>
            )}
          </button>
          <div className="mx-2 h-5 w-px bg-border" />
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-foreground uppercase">
                {userEmail?.charAt(0) ?? "U"}
              </div>
              <span className="hidden text-xs sm:inline">{userEmail?.split("@")[0] ?? "User"}</span>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
