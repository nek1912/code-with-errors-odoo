import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const { score, label, color } = getPasswordStrength(password);
  const percentage = (score / 5) * 100;

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={cn("h-full transition-all duration-300", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">Password strength</span>
        <span
          className={cn(
            "font-medium",
            score <= 2 && "text-red-500",
            score === 3 && "text-yellow-500",
            score === 4 && "text-blue-500",
            score === 5 && "text-green-500"
          )}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-neutral-500">
        <span className={cn(password.length >= 8 && "text-green-500")}>
          {password.length >= 8 ? "✓" : "○"} 8+ characters
        </span>
        <span className={cn(/[A-Z]/.test(password) && "text-green-500")}>
          {/[A-Z]/.test(password) ? "✓" : "○"} Uppercase letter
        </span>
        <span className={cn(/[a-z]/.test(password) && "text-green-500")}>
          {/[a-z]/.test(password) ? "✓" : "○"} Lowercase letter
        </span>
        <span className={cn(/[0-9]/.test(password) && "text-green-500")}>
          {/[0-9]/.test(password) ? "✓" : "○"} Number
        </span>
        <span className={cn(/[^A-Za-z0-9]/.test(password) && "text-green-500")}>
          {/[^A-Za-z0-9]/.test(password) ? "✓" : "○"} Special character
        </span>
      </div>
    </div>
  );
}
