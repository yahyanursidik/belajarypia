import type { PropsWithChildren } from "react";
import { ShellLayout } from "./ShellLayout";
import { getNavigationForRole } from "../lib/navigation";

export function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
