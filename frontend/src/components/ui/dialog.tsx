import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }
>(({ className, children, onClose, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative rounded-2xl border border-neutral-800/80 bg-neutral-900 p-0 shadow-2xl shadow-black/40",
      className
    )}
    {...props}
  >
    {children}
    {onClose && (
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-neutral-800/80 px-6 py-5",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold tracking-tight text-white", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm text-neutral-400", className)} {...props} />
  );
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-5", className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-neutral-800/80 px-6 py-4",
        className
      )}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter };
