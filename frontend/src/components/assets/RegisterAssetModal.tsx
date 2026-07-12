import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { registerAsset, getCategories, getDepartments, getErrorMessage } from "@/services/api";
import { toast } from "@/components/ui/toast";
import type { AssetRegisterPayload } from "@/lib/types";
import { ChevronDown } from "lucide-react";

const assetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  serial_number: z.string().max(255).optional().or(z.literal("")),
  category_id: z.string().optional().or(z.literal("")),
  department_id: z.string().optional().or(z.literal("")),
  acquisition_date: z.string().optional().or(z.literal("")),
  acquisition_cost: z.coerce
    .number()
    .positive("Cost must be a positive number")
    .optional()
    .or(z.nan()),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]),
  condition_notes: z.string().optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  is_shared: z.boolean(),
  photo_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type AssetFormValues = z.infer<typeof assetSchema>;

interface RegisterAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterAssetModal({ open, onOpenChange }: RegisterAssetModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: "",
      serial_number: "",
      category_id: "",
      department_id: "",
      acquisition_date: "",
      acquisition_cost: undefined,
      condition: "GOOD",
      condition_notes: "",
      location: "",
      is_shared: false,
      photo_url: "",
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: open,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (data: AssetRegisterPayload) => registerAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Asset registered successfully", variant: "success" });
      reset();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to register asset",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (values: any) => {
    const payload: AssetRegisterPayload = {
      name: values.name,
      serial_number: values.serial_number || undefined,
      category_id: values.category_id || undefined,
      department_id: values.department_id || undefined,
      acquisition_date: values.acquisition_date || undefined,
      acquisition_cost: values.acquisition_cost && !isNaN(values.acquisition_cost)
        ? values.acquisition_cost
        : undefined,
      condition: values.condition,
      condition_notes: values.condition_notes || undefined,
      location: values.location || undefined,
      is_shared: values.is_shared,
      photo_url: values.photo_url || undefined,
    };
    mutation.mutate(payload);
  };

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none";
  const labelCls = "block text-sm font-medium text-neutral-300 mb-1.5";
  const errorCls = "mt-1 text-xs text-red-400";
  const selectCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Register New Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="max-h-[60vh] overflow-y-auto space-y-4">
            {/* Name */}
            <div>
              <label className={labelCls}>Name *</label>
              <input {...register("name")} className={inputCls} placeholder="e.g. MacBook Pro 14&quot;" />
              {errors.name && <p className={errorCls}>{String(errors.name.message)}</p>}
            </div>

            {/* Serial + Condition (2-col) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Serial Number</label>
                <input {...register("serial_number")} className={inputCls} placeholder="e.g. SN-12345" />
              </div>
              <div>
                <label className={labelCls}>Condition *</label>
                <div className="relative">
                  <select {...register("condition")} className={selectCls}>
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </div>
            </div>

            {/* Category + Department (2-col) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Category</label>
                <div className="relative">
                  <select {...register("category_id")} className={selectCls}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Department</label>
                <div className="relative">
                  <select {...register("department_id")} className={selectCls}>
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <input {...register("location")} className={inputCls} placeholder="e.g. Floor 3, Bay 12" />
            </div>

            {/* Acquisition Date + Cost (2-col) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Acquisition Date</label>
                <input {...register("acquisition_date")} type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Acquisition Cost</label>
                <input
                  {...register("acquisition_cost")}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  placeholder="e.g. 1299.99"
                />
                 {errors.acquisition_cost && (
                   <p className={errorCls}>{String(errors.acquisition_cost.message)}</p>
                 )}
              </div>
            </div>

            {/* Condition Notes */}
            <div>
              <label className={labelCls}>Condition Notes</label>
              <textarea
                {...register("condition_notes")}
                className={`${inputCls} resize-none`}
                rows={2}
                placeholder="Any additional notes about the asset condition..."
              />
            </div>

            {/* Photo URL */}
            <div>
              <label className={labelCls}>Photo URL</label>
              <input
                {...register("photo_url")}
                className={inputCls}
                placeholder="https://example.com/photo.jpg"
              />
               {errors.photo_url && <p className={errorCls}>{String(errors.photo_url.message)}</p>}
            </div>

            {/* Shared toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={watch("is_shared")}
                onChange={(e) => setValue("is_shared", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-blue-600 focus:ring-blue-600/50"
              />
              <span className="text-sm text-neutral-300">Shared asset (visible to all departments)</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Registering..." : "Register Asset"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
