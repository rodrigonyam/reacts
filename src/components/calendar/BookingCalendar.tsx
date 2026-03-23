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
import type { CalendarEvent, Booking } from '../../types';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

interface BookingCalendarProps {
  bookings: Booking[];
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#0284c7',
  pending: '#d97706',
  cancelled: '#dc2626',
  completed: '#059669',
};

export function BookingCalendar({
  bookings,
  onSelectSlot,
  onSelectEvent,
}: BookingCalendarProps) {
  const [currentView, setCurrentView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());

  const events: CalendarEvent[] = useMemo(
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

  const eventStyleGetter = useCallback((event: Event) => {
    const calEvent = event as CalendarEvent;
    return {
      style: {
        backgroundColor: calEvent.color ?? '#0284c7',
        borderColor: calEvent.color ?? '#0284c7',
        color: '#fff',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 500,
      },
    };
  }, []);

  return (
    <div className="h-[680px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <Calendar
        localizer={localizer}
        events={events}
        view={currentView}
        onView={setCurrentView}
        date={currentDate}
        onNavigate={setCurrentDate}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={(e) => onSelectEvent?.(e as CalendarEvent)}
        eventPropGetter={eventStyleGetter}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        step={30}
        timeslots={2}
        popup
      />
    </div>
  );
}
