import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: "success" | "error" | "default";
}

let addToastFn: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(t: Omit<Toast, "id">) {
  addToastFn?.(t);
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToastFn = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const colors = {
          success: "border-emerald-800 bg-emerald-950 text-emerald-300",
          error: "border-red-800 bg-red-950 text-red-300",
          default: "border-neutral-800 bg-neutral-900 text-white",
        };
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px] animate-in slide-in-from-right-full",
              colors[t.variant]
            )}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="mt-1 text-xs opacity-80">{t.description}</p>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export { ToastContainer };
