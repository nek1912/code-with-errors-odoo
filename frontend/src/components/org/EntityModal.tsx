import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import api from "@/services/api";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";

const selectClass =
  "flex h-10 w-full appearance-none rounded-lg border border-neutral-700/80 bg-neutral-950 px-3 pr-10 text-sm text-white transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
    </div>
  );
}

// ── Schemas ───────────────────────────────────────────────────
const deptSchema = z.object({
  name: z.string().min(1, "Name is required"),
  head_user_id: z.string().optional().or(z.literal("")),
  parent_department_id: z.string().optional().or(z.literal("")),
});

const catSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  metadata_schema: z.string().optional(),
});

const roleSchema = z.object({
  role: z.enum(["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"]),
});

type DeptForm = z.infer<typeof deptSchema>;
type CatForm = z.infer<typeof catSchema>;
type RoleForm = z.infer<typeof roleSchema>;

type EntityType = "department" | "category" | "role";

interface EntityModalProps {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  editData?: any;
}

export function EntityModal({ open, onClose, entityType, editData }: EntityModalProps) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const { data: users = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
    enabled: open && entityType === "department",
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments")).data,
    enabled: open && entityType === "department",
  });

  // ── Department Form ───────────────────────────────────────
  const deptForm = useForm<DeptForm>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", head_user_id: "", parent_department_id: "" },
  });

  useEffect(() => {
    if (open && entityType === "department") {
      deptForm.reset({
        name: editData?.name ?? "",
        head_user_id: editData?.head_user_id ?? "",
        parent_department_id: editData?.parent_department_id ?? "",
      });
    }
  }, [open, editData, entityType]);

  const deptMutation = useMutation({
    mutationFn: async (data: DeptForm) => {
      const payload: any = { name: data.name };
      if (data.head_user_id) payload.head_user_id = data.head_user_id;
      if (data.parent_department_id) payload.parent_department_id = data.parent_department_id;
      if (isEdit) return api.put(`/departments/${editData.id}`, payload);
      return api.post("/departments", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: isEdit ? "Department updated" : "Department created", variant: "success" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "error" });
    },
  });

  // ── Category Form ─────────────────────────────────────────
  const catForm = useForm<CatForm>({
    resolver: zodResolver(catSchema),
    defaultValues: { name: "", description: "", metadata_schema: "" },
  });

  useEffect(() => {
    if (open && entityType === "category") {
      catForm.reset({
        name: editData?.name ?? "",
        description: editData?.description ?? "",
        metadata_schema: editData?.metadata_schema
          ? JSON.stringify(editData.metadata_schema, null, 2)
          : "",
      });
    }
  }, [open, editData, entityType]);

  const catMutation = useMutation({
    mutationFn: async (data: CatForm) => {
      const payload: any = { name: data.name };
      if (data.description) payload.description = data.description;
      if (data.metadata_schema) {
        try {
          payload.metadata_schema = JSON.parse(data.metadata_schema);
        } catch {
          throw new Error("Invalid JSON in custom fields");
        }
      }
      if (isEdit) return api.put(`/categories/${editData.id}`, payload);
      return api.post("/categories", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: isEdit ? "Category updated" : "Category created", variant: "success" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "error" });
    },
  });

  // ── Role Form ─────────────────────────────────────────────
  const roleForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role: "EMPLOYEE" },
  });

  useEffect(() => {
    if (open && entityType === "role") {
      roleForm.reset({ role: editData?.role ?? "EMPLOYEE" });
    }
  }, [open, editData, entityType]);

  const roleMutation = useMutation({
    mutationFn: async (data: RoleForm) => {
      return api.put(`/employees/${editData.id}/role`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Role updated", variant: "success" });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "error" });
    },
  });

  const titles: Record<EntityType, { heading: string; sub?: string }> = {
    department: {
      heading: isEdit ? "Edit Department" : "Create Department",
      sub: isEdit ? "Update department details" : "Add a new department to your organization",
    },
    category: {
      heading: isEdit ? "Edit Category" : "Create Category",
      sub: isEdit ? "Update category details" : "Add a new asset category",
    },
    role: {
      heading: "Change Role",
      sub: `Update role for ${editData?.full_name ?? "user"}`,
    },
  };

  const isPending = deptMutation.isPending || catMutation.isPending || roleMutation.isPending;
  const info = titles[entityType];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{info.heading}</DialogTitle>
          {info.sub && <p className="text-sm text-neutral-500 mt-1">{info.sub}</p>}
        </DialogHeader>

        {/* ── Department ────────────────────────────────────── */}
        {entityType === "department" && (
          <form onSubmit={deptForm.handleSubmit((d) => deptMutation.mutate(d))}>
            <DialogBody className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Department Name</Label>
                <Input
                  id="dept-name"
                  {...deptForm.register("name")}
                  placeholder="e.g. Engineering"
                />
                {deptForm.formState.errors.name && (
                  <p className="text-xs text-red-400">
                    {deptForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Head of Department</Label>
                <SelectWrapper>
                  <select
                    {...deptForm.register("head_user_id")}
                    className={selectClass}
                  >
                    <option value="">No head assigned</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>
              <div className="space-y-2">
                <Label>Parent Department</Label>
                <SelectWrapper>
                  <select
                    {...deptForm.register("parent_department_id")}
                    className={selectClass}
                  >
                    <option value="">None (top-level)</option>
                    {departments
                      .filter((d: any) => d.id !== editData?.id)
                      .map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </SelectWrapper>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isPending}>
                {isEdit ? "Save Changes" : "Create Department"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Category ──────────────────────────────────────── */}
        {entityType === "category" && (
          <form onSubmit={catForm.handleSubmit((d) => catMutation.mutate(d))}>
            <DialogBody className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Category Name</Label>
                <Input
                  id="cat-name"
                  {...catForm.register("name")}
                  placeholder="e.g. Laptops"
                />
                {catForm.formState.errors.name && (
                  <p className="text-xs text-red-400">
                    {catForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Description</Label>
                <Input
                  id="cat-desc"
                  {...catForm.register("description")}
                  placeholder="Brief description (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-fields">Custom Fields (JSON)</Label>
                <textarea
                  id="cat-fields"
                  {...catForm.register("metadata_schema")}
                  rows={4}
                  placeholder={'{"warranty_months": "number", "color": "string"}'}
                  className="flex w-full rounded-lg border border-neutral-700/80 bg-neutral-950 px-3 py-2.5 text-sm text-white font-mono placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs text-neutral-600">
                  Keys must be alphanumeric. Define field names and types.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isPending}>
                {isEdit ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Role ──────────────────────────────────────────── */}
        {entityType === "role" && (
          <form onSubmit={roleForm.handleSubmit((d) => roleMutation.mutate(d))}>
            <DialogBody className="space-y-5">
              <div className="rounded-lg border border-blue-900/30 bg-blue-950/20 px-4 py-3">
                <p className="text-sm text-blue-300">
                  Changing role for{" "}
                  <span className="font-semibold text-white">{editData?.full_name}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Assign Role</Label>
                <SelectWrapper>
                  <select {...roleForm.register("role")} className={selectClass}>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="DEPARTMENT_HEAD">Department Head</option>
                    <option value="ASSET_MANAGER">Asset Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </SelectWrapper>
                <p className="text-xs text-neutral-600">
                  Role determines what the user can see and do in the system.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isPending}>
                Update Role
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
