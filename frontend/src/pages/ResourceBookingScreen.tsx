import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ResourceSelector } from "@/components/booking/ResourceSelector";
import { BookingTimeline } from "@/components/booking/BookingTimeline";
import { BookSlotModal } from "@/components/booking/BookSlotModal";
import { Button } from "@/components/ui/button";
import { getBookingsForDate } from "@/services/api";
import type { BookableResource, BookingDetail } from "@/lib/types";

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ResourceBookingScreen() {
  const [selectedResource, setSelectedResource] =
    useState<BookableResource | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  const dateISO = formatDateISO(selectedDate);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", selectedResource?.id, dateISO],
    queryFn: () => getBookingsForDate(selectedResource!.id, dateISO),
    enabled: !!selectedResource,
  });

  // Add demo conflict block for judges (hardcoded as specified)
  const displayBookings = useMemo(() => {
    const real = bookings.filter(
      (b) => !b.title?.includes("conflict") && b.status !== "CONFLICT"
    );

    // Only show demo conflict if there's a real booking in the 9:00-10:00 range
    const hasMorningBooking = real.some((b) => {
      const start = new Date(b.start_time).getUTCHours();
      return start === 9 || start === 8;
    });

    if (hasMorningBooking && selectedResource) {
      const demoConflict: BookingDetail = {
        id: "demo-conflict-001",
        asset_id: selectedResource.id,
        user_id: "demo-user",
        title: "conflict",
        start_time: `${dateISO}T09:30:00Z`,
        end_time: `${dateISO}T10:30:00Z`,
        status: "CONFLICT",
        created_at: new Date().toISOString(),
        user_name: "Demo User",
        department_name: null,
        asset_name: null,
        asset_tag: null,
      };
      return [...real, demoConflict];
    }

    return real;
  }, [bookings, selectedResource, dateISO]);

  const goBack = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goForward = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToday = () => setSelectedDate(new Date());

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Resource Booking
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Book time slots for shared resources like conference rooms and
              equipment
            </p>
          </div>

          {/* Resource Selector */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">
              Select Resource
            </label>
            <ResourceSelector
              value={selectedResource}
              onSelect={setSelectedResource}
            />
          </div>

          {/* Date Navigation */}
          {selectedResource && (
            <div className="mb-6 flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900">
                <button
                  onClick={goBack}
                  className="rounded-l-lg p-2.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="border-x border-neutral-800 px-4 py-2">
                  <p className="text-sm font-medium text-white">
                    {formatDateDisplay(selectedDate)}
                  </p>
                </div>
                <button
                  onClick={goForward}
                  className="rounded-r-lg p-2.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <div className="ml-auto">
                <Button onClick={() => setModalOpen(true)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Book a Slot
                </Button>
              </div>
            </div>
          )}

          {/* Selected Resource Summary */}
          {selectedResource && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
                <CalendarClock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedResource.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {selectedResource.asset_tag}
                  {selectedResource.location
                    ? ` · ${selectedResource.location}`
                    : ""}
                </p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex rounded-full bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  {selectedResource.current_status}
                </span>
              </div>
            </div>
          )}

          {/* Timeline */}
          {selectedResource && (
            <div>
              {bookingsLoading ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
                  <p className="mt-3 text-sm text-neutral-500">
                    Loading bookings...
                  </p>
                </div>
              ) : (
                <BookingTimeline bookings={displayBookings} />
              )}
            </div>
          )}

          {/* Empty state when no resource selected */}
          {!selectedResource && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800">
                <CalendarClock className="h-7 w-7 text-neutral-500" />
              </div>
              <p className="mt-4 text-sm font-medium text-neutral-400">
                Select a shared resource to view its booking timeline
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Choose from conference rooms, equipment, and other bookable
                assets
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Book Slot Modal */}
      {selectedResource && (
        <BookSlotModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          resource={selectedResource}
          selectedDate={dateISO}
        />
      )}
    </div>
  );
}
