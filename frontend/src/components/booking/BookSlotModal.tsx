import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock } from "lucide-react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBooking } from "@/services/api";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/services/api";
import type { BookableResource } from "@/lib/types";

const bookingSchema = z
  .object({
    title: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
  })
  .refine(
    (data) => {
      if (!data.date || !data.start_time || !data.end_time) return true;
      const start = new Date(`${data.date}T${data.start_time}:00Z`);
      const end = new Date(`${data.date}T${data.end_time}:00Z`);
      return end > start;
    },
    { message: "End time must be after start time", path: ["end_time"] }
  );

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: BookableResource;
  selectedDate: string;
}

const TIME_OPTIONS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function BookSlotModal({
  open,
  onOpenChange,
  resource,
  selectedDate,
}: BookSlotModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      title: "",
      date: selectedDate,
      start_time: "09:00",
      end_time: "10:00",
    },
  });

  const startTime = watch("start_time");
  const endTime = watch("end_time");

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking created successfully", variant: "success" });
      reset();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Booking failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const onSubmit = (values: BookingFormValues) => {
    const startISO = `${values.date}T${values.start_time}:00Z`;
    const endISO = `${values.date}T${values.end_time}:00Z`;

    createMutation.mutate({
      asset_id: resource.id,
      start_time: startISO,
      end_time: endISO,
      title: values.title || undefined,
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
              <CalendarClock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <DialogTitle>Book a Slot</DialogTitle>
              <DialogDescription>
                {resource.name} ({resource.asset_tag})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Title (optional)</Label>
              <input
                {...register("title")}
                placeholder="e.g. Team standup, Client call..."
                className={inputCls}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Date</Label>
              <input
                type="date"
                {...register("date")}
                className={inputCls}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Start Time</Label>
                <select
                  {...register("start_time")}
                  className={inputCls}
                  onChange={(e) => {
                    setValue("start_time", e.target.value, {
                      shouldValidate: true,
                    });
                    // Auto-set end_time to 1 hour after start if end is before start
                    const [h, m] = e.target.value.split(":").map(Number);
                    const endMin = h * 60 + m + 60;
                    if (endMin <= 20 * 60) {
                      const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                      if (newEnd <= (endTime || "99:99")) {
                        setValue("end_time", newEnd, { shouldValidate: true });
                      }
                    }
                  }}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {formatTimeLabel(t)}
                    </option>
                  ))}
                </select>
                {errors.start_time && (
                  <p className={errorCls}>{errors.start_time.message}</p>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">End Time</Label>
                <select
                  {...register("end_time")}
                  className={inputCls}
                >
                  {TIME_OPTIONS.filter((t) => t > startTime).map((t) => (
                    <option key={t} value={t}>
                      {formatTimeLabel(t)}
                    </option>
                  ))}
                </select>
                {errors.end_time && (
                  <p className={errorCls}>{errors.end_time.message}</p>
                )}
              </div>
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
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Book Slot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
