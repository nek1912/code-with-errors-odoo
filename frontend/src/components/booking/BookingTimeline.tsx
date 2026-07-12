import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { BookingDetail } from "@/lib/types";

interface BookingTimelineProps {
  bookings: BookingDetail[];
  dayStart?: number;
  dayEnd?: number;
}

const HOUR_HEIGHT = 64; // px per hour

function timeToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function BookingTimeline({
  bookings,
  dayStart = 8,
  dayEnd = 20,
}: BookingTimelineProps) {
  const hours = useMemo(() => {
    const result = [];
    for (let h = dayStart; h <= dayEnd; h++) {
      result.push(h);
    }
    return result;
  }, [dayStart, dayEnd]);

  const totalMinutes = (dayEnd - dayStart) * 60;

  const positionedBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status !== "CANCELLED")
      .map((b) => {
        const startMin = timeToMinutes(b.start_time);
        const endMin = timeToMinutes(b.end_time);
        const clampedStart = Math.max(startMin, dayStart * 60);
        const clampedEnd = Math.min(endMin, dayEnd * 60);
        const top = ((clampedStart - dayStart * 60) / totalMinutes) * 100;
        const height = ((clampedEnd - clampedStart) / totalMinutes) * 100;
        return { ...b, top, height: Math.max(height, 2) };
      });
  }, [bookings, dayStart, dayEnd, totalMinutes]);

  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-blue-600" />
        <span className="text-xs font-medium text-neutral-400">Booked</span>
        <div className="h-3 w-3 rounded-full border-2 border-dashed border-red-500 bg-red-950/20" />
        <span className="text-xs font-medium text-neutral-400">Conflict</span>
      </div>

      {/* Timeline */}
      <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
        {/* Hour grid lines */}
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute left-0 right-0 flex"
            style={{ top: i * HOUR_HEIGHT }}
          >
            <div className="w-16 shrink-0 pr-3 text-right">
              <span className="text-xs font-medium text-neutral-500">
                {getMinutesLabel(hour * 60)}
              </span>
            </div>
            <div className="flex-1 border-t border-neutral-800/60" />
          </div>
        ))}

        {/* Booking blocks */}
        <div className="absolute left-16 right-0 top-0 bottom-0">
          {positionedBookings.map((booking) => {
            const isConflict =
              booking.title?.includes("conflict") ||
              booking.status === "CONFLICT";

            return (
              <div
                key={booking.id}
                className={cn(
                  "absolute left-2 right-2 rounded-lg border px-3 py-2 text-xs",
                  isConflict
                    ? "border-red-500 border-dashed bg-red-950/20"
                    : "border-blue-700 bg-blue-900/50"
                )}
                style={{
                  top: `${booking.top}%`,
                  height: `${booking.height}%`,
                  minHeight: "48px",
                }}
              >
                <div className="flex h-full flex-col justify-center">
                  {isConflict ? (
                    <>
                      <p className="font-medium text-red-400">
                        Requested {formatTime(booking.start_time)} to{" "}
                        {formatTime(booking.end_time)}
                      </p>
                      <p className="mt-0.5 text-red-400/70">
                        conflict — slot is unavailable
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-blue-200">
                        Booked — {booking.user_name || "User"}
                        {booking.department_name
                          ? ` (${booking.department_name})`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-blue-300/70">
                        {formatTime(booking.start_time)} to{" "}
                        {formatTime(booking.end_time)}
                      </p>
                      {booking.title && (
                        <p className="mt-0.5 text-blue-300/50">
                          {booking.title}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
