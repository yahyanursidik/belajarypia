import { Loader2 } from "lucide-react";
import { appName } from "../../lib/constants";
import { useSystemSettings } from "../../lib/useSystemSettings";

export function FullPageLoader({ message = "Memuat halaman..." }: { message?: string }) {
  const { settings } = useSystemSettings();
  const name = settings?.institution_name || appName;

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-6 animate-pulse duration-1000">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <div className="flex flex-col items-center space-y-2 text-center">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{name}</h3>
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
