import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Box } from "lucide-react";
import { getAssets } from "@/services/api";
import type { Asset } from "@/lib/types";

interface AssetSelectorProps {
  value: Asset | null;
  onSelect: (asset: Asset | null) => void;
  placeholder?: string;
}

export function AssetSelector({
  value,
  onSelect,
  placeholder = "Search assets by tag, name, or serial...",
}: AssetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assets-selector", search],
    queryFn: () => getAssets({ search: search || undefined, limit: 15 }),
    enabled: open,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (asset: Asset) => {
      onSelect(asset);
      setSearch("");
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
    setSearch("");
    inputRef.current?.focus();
  }, [onSelect]);

  return (
    <div ref={containerRef} className="relative">
      {/* Selected display or search input */}
      {value && !open ? (
        <button
          onClick={() => {
            setOpen(true);
            setSearch("");
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-left transition-colors hover:border-neutral-600"
        >
          <Box className="h-4 w-4 shrink-0 text-blue-400" />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-sm font-medium text-blue-400">
              {value.asset_tag}
            </span>
            <span className="ml-2 text-sm text-white">{value.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/40">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-neutral-500">
              Searching...
            </div>
          ) : !data?.items.length ? (
            <div className="p-4 text-center text-sm text-neutral-500">
              No assets found
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {data.items.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelect(asset)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-800"
                >
                  <Box className="h-4 w-4 shrink-0 text-neutral-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-blue-400">
                        {asset.asset_tag}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          asset.current_status === "AVAILABLE"
                            ? "bg-emerald-600/20 text-emerald-400"
                            : asset.current_status === "ALLOCATED"
                            ? "bg-blue-600/20 text-blue-400"
                            : "bg-neutral-700 text-neutral-400"
                        }`}
                      >
                        {asset.current_status}
                      </span>
                    </div>
                    <p className="truncate text-xs text-neutral-400">
                      {asset.name}
                      {asset.serial_number ? ` • SN: ${asset.serial_number}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
