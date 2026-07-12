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
import { Shield, Power, Users } from "lucide-react";

interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department_name: string | null;
  is_active: boolean;
  created_at: string;
}

const roleConfig: Record<string, { label: string; variant: string }> = {
  ADMIN: { label: "Admin", variant: "destructive" },
  ASSET_MANAGER: { label: "Asset Manager", variant: "warning" },
  DEPARTMENT_HEAD: { label: "Dept Head", variant: "default" },
  EMPLOYEE: { label: "Employee", variant: "secondary" },
};

export function EmployeesTab({ onEditRole }: { onEditRole: (e: Employee) => void }) {
  const qc = useQueryClient();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });

  const toggleStatus = useMutation({
    mutationFn: async (e: Employee) => {
      return api.patch(`/employees/${e.id}/status`, { is_active: !e.is_active });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
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
          <Users className="h-4 w-4 text-neutral-400" />
          Employee Directory
          <Badge variant="secondary" className="ml-auto">
            {employees.length}
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
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <Users className="h-6 w-6 text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-400">No employees found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const rc = roleConfig[e.role] ?? { label: e.role, variant: "secondary" };
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-white">{e.full_name}</TableCell>
                    <TableCell className="text-neutral-400">{e.email}</TableCell>
                    <TableCell className="text-neutral-400">
                      {e.department_name || <span className="text-neutral-600">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rc.variant as any}>{rc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.is_active ? "success" : "destructive"}>
                        {e.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onEditRole(e)}
                          title="Change role"
                        >
                          <Shield className="h-3.5 w-3.5 text-neutral-400" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleStatus.mutate(e)}
                          disabled={toggleStatus.isPending}
                          title="Toggle active status"
                        >
                          <Power
                            className={`h-3.5 w-3.5 ${
                              e.is_active ? "text-emerald-400" : "text-neutral-600"
                            }`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
