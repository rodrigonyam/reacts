import { useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type Event,
  type SlotInfo,
  Views,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import type { CalendarEvent, Booking, TimeSlot } from '../../types';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

interface BookingCalendarProps {
  bookings: Booking[];
  slots?: TimeSlot[];
  showAvailability?: boolean;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#0284c7',
  pending: '#d97706',
  cancelled: '#dc2626',
  completed: '#059669',
};

/** Returns a green→amber→red colour based on how full a slot is */
function availabilityColor(booked: number, capacity: number): string {
  const ratio = capacity === 0 ? 1 : booked / capacity;
  if (ratio >= 1) return '#ef4444';     // full – red
  if (ratio >= 0.5) return '#f59e0b';  // filling – amber
  return '#10b981';                     // open – green
}

export function BookingCalendar({
  bookings,
  slots = [],
  showAvailability = true,
  onSelectSlot,
  onSelectEvent,
}: BookingCalendarProps) {
  const [currentView, setCurrentView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Booking events (coloured by status)
  const bookingEvents: CalendarEvent[] = useMemo(
    () =>
      bookings
        .filter((b) => b.slot)
        .map((b) => {
          const [startH, startM] = b.slot!.startTime.split(':').map(Number);
          const [endH, endM] = b.slot!.endTime.split(':').map(Number);
          const base = new Date(b.slot!.date);
          const start = new Date(base);
          start.setHours(startH, startM, 0);
          const end = new Date(base);
          end.setHours(endH, endM, 0);

          return {
            id: b.id,
            title: `${b.user?.name ?? 'Guest'} – ${b.service?.name ?? ''}`,
            start,
            end,
            resource: b,
            color: STATUS_COLORS[b.status] ?? '#0284c7',
          };
        }),
    [bookings],
  );

  // Availability background events (slots not already shown as bookings)
  const availabilityEvents = useMemo(() => {
    if (!showAvailability) return [];
    const bookedSlotIds = new Set(bookings.map((b) => b.slotId));
    return slots
      .filter((s) => !bookedSlotIds.has(s.id))
      .map((s) => {
        const [startH, startM] = s.startTime.split(':').map(Number);
        const [endH, endM] = s.endTime.split(':').map(Number);
        const base = new Date(s.date);
        const start = new Date(base);
        start.setHours(startH, startM, 0);
        const end = new Date(base);
        end.setHours(endH, endM, 0);
        const spotsLeft = s.capacity - s.booked;
        return {
          id: `avail-${s.id}`,
          title: spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} available` : 'Full',
          start,
          end,
          resource: null as unknown as Booking,
          color: availabilityColor(s.booked, s.capacity),
        } as CalendarEvent;
      });
  }, [slots, bookings, showAvailability]);

  const events = useMemo(
    () => [...availabilityEvents, ...bookingEvents],
    [availabilityEvents, bookingEvents],
  );

  const eventStyleGetter = useCallback((event: Event) => {
    const calEvent = event as CalendarEvent;
    const isAvailability = calEvent.id.toString().startsWith('avail-');
    return {
      style: {
        backgroundColor: isAvailability
          ? `${calEvent.color ?? '#10b981'}22`   // low opacity background for availability
          : calEvent.color ?? '#0284c7',
        borderLeft: isAvailability
          ? `3px solid ${calEvent.color ?? '#10b981'}`
          : undefined,
        borderColor: isAvailability ? 'transparent' : calEvent.color ?? '#0284c7',
        color: isAvailability ? calEvent.color ?? '#059669' : '#fff',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: isAvailability ? 400 : 500,
        fontStyle: isAvailability ? 'italic' : 'normal',
      },
    };
  }, []);

  const legendItems = [
    { color: '#10b981', label: 'Available' },
    { color: '#f59e0b', label: 'Filling up' },
    { color: '#ef4444', label: 'Full' },
    { color: '#0284c7', label: 'Confirmed' },
    { color: '#d97706', label: 'Pending' },
    { color: '#059669', label: 'Completed' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Legend */}
      {showAvailability && (
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Legend</span>
          {legendItems.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="h-[640px] p-4">
        <Calendar
          localizer={localizer}
          events={events}
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          selectable
          onSelectSlot={onSelectSlot}
          onSelectEvent={(e) => {
            const calEvent = e as CalendarEvent;
            if (!calEvent.id.toString().startsWith('avail-')) {
              onSelectEvent?.(calEvent);
            }
          }}
          eventPropGetter={eventStyleGetter}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          step={30}
          timeslots={2}
          popup
        />
      </div>
    </div>
  );
}
