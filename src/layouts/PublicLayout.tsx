import type { PropsWithChildren } from "react";
import { ShellLayout } from "./ShellLayout";
import { getNavigationForRole } from "../lib/navigation";

export function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 w-full">
        {children}
      </main>
      
      <footer className="mt-auto py-6 text-center text-sm text-slate-500 border-t border-slate-200 print:hidden w-full bg-white">
        <p>
          Disusun dan dikembangkan oleh{' '}
          <a href="https://yahyanursidik.my.id/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold transition-colors">
            Yahya Nursidik
          </a>
        </p>
      </footer>
    </div>
  );
}
