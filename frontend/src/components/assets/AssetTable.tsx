import { Eye, Package } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./StatusBadge";
import type { Asset } from "@/lib/types";

interface AssetTableProps {
  assets: Asset[];
  isLoading: boolean;
  onSelectAsset: (asset: Asset) => void;
}

export function AssetTable({ assets, isLoading, onSelectAsset }: AssetTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded-lg" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800">
          <Package className="h-7 w-7 text-neutral-500" />
        </div>
        <p className="text-sm font-medium text-white">No assets found</p>
        <p className="mt-1 text-xs text-neutral-500">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="w-[100px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell>
                <span className="font-mono text-sm font-medium text-blue-400">
                  {asset.asset_tag}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-white">{asset.name}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-neutral-400">
                  {asset.category_name ?? "—"}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={asset.current_status} />
              </TableCell>
              <TableCell>
                <span className="text-sm text-neutral-400">
                  {asset.location ?? "—"}
                </span>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onSelectAsset(asset)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
