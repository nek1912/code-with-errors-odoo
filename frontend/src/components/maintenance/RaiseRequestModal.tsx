import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createMaintenanceRequest,
  getAssets,
  getErrorMessage,
} from "@/services/api";
import { toast } from "@/components/ui/toast";
import type { Asset } from "@/lib/types";

const raiseSchema = z.object({
  asset_id: z.string().min(1, "Select an asset"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
    errorMap: () => ({ message: "Select a priority" }),
  }),
  issue_description: z
    .string()
    .min(1, "Describe the issue")
    .max(2000, "Description too long"),
});

type RaiseFormValues = z.infer<typeof raiseSchema>;

interface RaiseRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RaiseRequestModal({
  open,
  onOpenChange,
}: RaiseRequestModalProps) {
  const queryClient = useQueryClient();
  const [assetSearch, setAssetSearch] = useState("");
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const { data: assetData } = useQuery({
    queryKey: ["assets-selector", assetSearch],
    queryFn: () => getAssets({ search: assetSearch || undefined, limit: 50 }),
    enabled: showAssetDropdown,
  });

  const assets: Asset[] = assetData?.items ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RaiseFormValues>({
    resolver: zodResolver(raiseSchema),
    defaultValues: {
      asset_id: "",
      priority: "MEDIUM",
      issue_description: "",
    },
  });

  const selectedAssetId = watch("asset_id");
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const createMutation = useMutation({
    mutationFn: createMaintenanceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      toast({
        title: "Maintenance request raised",
        variant: "success",
      });
      reset();
      setAssetSearch("");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to raise request",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const onSubmit = (values: RaiseFormValues) => {
    createMutation.mutate({
      asset_id: values.asset_id,
      priority: values.priority,
      issue_description: values.issue_description,
    });
  };

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none";
  const errorCls = "mt-1 text-xs text-red-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600/10">
              <Wrench className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <DialogTitle>Raise Maintenance Request</DialogTitle>
              <DialogDescription>
                Report an issue with an asset
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            {/* Asset Selector */}
            <div>
              <Label className="mb-1.5 block">Asset *</Label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or tag..."
                  value={
                    selectedAsset
                      ? `${selectedAsset.asset_tag} - ${selectedAsset.name}`
                      : assetSearch
                  }
                  onChange={(e) => {
                    setAssetSearch(e.target.value);
                    setValue("asset_id", "", { shouldValidate: true });
                    setShowAssetDropdown(true);
                  }}
                  onFocus={() => setShowAssetDropdown(true)}
                  className={inputCls}
                />
                {showAssetDropdown && assets.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 shadow-lg">
                    {assets
                      .filter((a) => a.is_active)
                      .map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setValue("asset_id", asset.id, {
                              shouldValidate: true,
                            });
                            setAssetSearch("");
                            setShowAssetDropdown(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700"
                        >
                          <span className="font-mono text-xs text-blue-400">
                            {asset.asset_tag}
                          </span>
                          <span>{asset.name}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {errors.asset_id && (
                <p className={errorCls}>{errors.asset_id.message}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <Label className="mb-1.5 block">Priority *</Label>
              <select {...register("priority")} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              {errors.priority && (
                <p className={errorCls}>{errors.priority.message}</p>
              )}
            </div>

            {/* Issue Description */}
            <div>
              <Label className="mb-1.5 block">Issue Description *</Label>
              <textarea
                {...register("issue_description")}
                rows={4}
                placeholder="Describe the issue in detail..."
                className={`${inputCls} resize-none`}
              />
              {errors.issue_description && (
                <p className={errorCls}>
                  {errors.issue_description.message}
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              disabled={createMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Wrench className="mr-2 h-4 w-4" />
              Raise Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
