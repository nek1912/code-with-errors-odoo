import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "@/components/ui/toast";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pencil, Power, Building2 } from "lucide-react";

interface Department {
  id: string;
  name: string;
  head_name: string | null;
  parent_name: string | null;
  is_active: boolean;
  created_at: string;
}

export function DepartmentsTab({ onEdit }: { onEdit: (d: Department) => void }) {
  const qc = useQueryClient();

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments")).data,
  });

  const toggleStatus = useMutation({
    mutationFn: async (d: Department) => {
      return api.patch(`/departments/${d.id}/status`, { is_active: !d.is_active });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Status updated", variant: "success" });
    },
    onError: (e: any) => {
      toast({
        title: "Cannot toggle status",
        description: e.response?.data?.detail || "Unknown error",
        variant: "error",
      });
    },
  });

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
          <Building2 className="h-4 w-4 text-neutral-400" />
          Departments
          <Badge variant="secondary" className="ml-auto">
            {departments.length}
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
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <Building2 className="h-6 w-6 text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-400">No departments yet</p>
            <p className="mt-1 text-xs text-neutral-600">
              Click the "+ Add Department" button to create your first department.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Department Name</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>Parent Dept</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-white">{d.name}</TableCell>
                  <TableCell className="text-neutral-400">
                    {d.head_name || <span className="text-neutral-600">Unassigned</span>}
                  </TableCell>
                  <TableCell className="text-neutral-400">
                    {d.parent_name || <span className="text-neutral-600">None</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "success" : "destructive"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => onEdit(d)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleStatus.mutate(d)}
                        disabled={toggleStatus.isPending}
                      >
                        <Power
                          className={`h-3.5 w-3.5 ${
                            d.is_active ? "text-emerald-400" : "text-neutral-600"
                          }`}
                        />
                      </Button>
                    </div>
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
