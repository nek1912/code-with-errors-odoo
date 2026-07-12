import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBookableResources } from "@/services/api";
import type { BookableResource } from "@/lib/types";

interface ResourceSelectorProps {
  value: BookableResource | null;
  onSelect: (resource: BookableResource) => void;
}

export function ResourceSelector({ value, onSelect }: ResourceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["bookable-resources"],
    queryFn: getBookableResources,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = resources.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
      (r.location && r.location.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-neutral-900 px-4 py-3 text-left transition-colors",
          open
            ? "border-blue-600 ring-1 ring-blue-600/50"
            : "border-neutral-800 hover:border-neutral-700"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10">
          <Search className="h-4 w-4 text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <p className="text-sm font-medium text-white">
                {value.name} — {value.asset_tag}
              </p>
              {value.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                  <MapPin className="h-3 w-3" />
                  {value.location}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              {isLoading ? "Loading resources..." : "Select a shared resource..."}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-neutral-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl shadow-black/40">
          <div className="border-b border-neutral-800 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, tag, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-neutral-500">
                  {isLoading ? "Loading..." : "No bookable resources found"}
                </p>
              </div>
            ) : (
              filtered.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => {
                    onSelect(resource);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    value?.id === resource.id
                      ? "bg-blue-600/10 text-blue-400"
                      : "text-neutral-300 hover:bg-neutral-800"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{resource.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                      <span className="font-mono">{resource.asset_tag}</span>
                      {resource.location && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {resource.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Available
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
