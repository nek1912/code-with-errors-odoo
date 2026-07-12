import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AssetTable } from "@/components/assets/AssetTable";
import { RegisterAssetModal } from "@/components/assets/RegisterAssetModal";
import { AssetDetailsSheet } from "@/components/assets/AssetDetailsSheet";
import { getAssets, getCategories, getDepartments } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import type { Asset, AssetDirectoryParams } from "@/lib/types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AssetDirectory() {
  const { user } = useAuthStore();
  const canRegister = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const params: AssetDirectoryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category_id: categoryId || undefined,
      status: status || undefined,
      department_id: departmentId || undefined,
      page,
      limit,
    }),
    [debouncedSearch, categoryId, status, departmentId, page]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["assets", params],
    queryFn: () => getAssets(params),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-filter"],
    queryFn: getCategories,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-filter"],
    queryFn: getDepartments,
  });

  // Modal state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleSelectAsset = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
  }, []);

  const resetFilters = () => {
    setSearch("");
    setCategoryId("");
    setStatus("");
    setDepartmentId("");
    setPage(1);
  };

  const hasFilters = search || categoryId || status || departmentId;

  const selectCls =
    "rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none pr-8";

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Assets</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {data?.total ?? 0} total assets
              </p>
            </div>
            {canRegister && (
              <button
                onClick={() => setRegisterOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Register Asset
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by tag, serial, or name..."
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
                className={selectCls}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>

            <div className="relative">
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className={selectCls}
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="RESERVED">Reserved</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="LOST">Lost</option>
                <option value="RETIRED">Retired</option>
                <option value="DISPOSED">Disposed</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>

            <div className="relative">
              <select
                value={departmentId}
                onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
                className={selectCls}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>

            {hasFilters && (
              <button
                onClick={resetFilters}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <AssetTable
            assets={data?.items ?? []}
            isLoading={isLoading}
            onSelectAsset={handleSelectAsset}
          />

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Showing {((data.page - 1) * data.limit) + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(data.pages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (data.pages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= data.pages - 2) {
                    pageNum = data.pages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? "bg-blue-600 text-white"
                          : "border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Register Modal */}
      <RegisterAssetModal open={registerOpen} onOpenChange={setRegisterOpen} />

      {/* Details Sheet */}
      <AssetDetailsSheet
        assetId={selectedAsset?.id ?? null}
        open={!!selectedAsset}
        onOpenChange={(o) => { if (!o) setSelectedAsset(null); }}
      />
    </div>
  );
}
