import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 pb-20 md:pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}
