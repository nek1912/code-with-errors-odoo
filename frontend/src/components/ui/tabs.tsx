import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({ value: "", onValueChange: () => {} });

function Tabs({ value: controlledValue, onValueChange, defaultValue = "", className, children, ...props }: TabsProps & { defaultValue?: string }) {
  const [internal, setInternal] = React.useState(defaultValue);
  const value = controlledValue ?? internal;
  const setter = onValueChange ?? setInternal;
  return (
    <TabsContext.Provider value={{ value, onValueChange: setter }}>
      <div className={cn("w-full", className)} {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 p-1 text-neutral-400 border border-neutral-800",
        className
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all",
        isActive
          ? "bg-neutral-800 text-white shadow-sm"
          : "text-neutral-400 hover:text-white",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("mt-4 focus-visible:outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
