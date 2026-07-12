import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pencil, FolderOpen } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  metadata_schema: Record<string, any> | null;
  field_count: number;
  is_active: boolean;
  created_at: string;
}

export function CategoriesTab({ onEdit }: { onEdit: (c: Category) => void }) {
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
          <FolderOpen className="h-4 w-4 text-neutral-400" />
          Asset Categories
          <Badge variant="secondary" className="ml-auto">
            {categories.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg bg-neutral-800" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <FolderOpen className="h-6 w-6 text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-400">No categories yet</p>
            <p className="mt-1 text-xs text-neutral-600">
              Click the "+ Add Category" button to create your first category.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Custom Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-white">{c.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-neutral-400">
                    {c.description || <span className="text-neutral-600">No description</span>}
                  </TableCell>
                  <TableCell>
                    {c.field_count > 0 ? (
                      <Badge variant="secondary">
                        {c.field_count} field{c.field_count !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "success" : "destructive"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
