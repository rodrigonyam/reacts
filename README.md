# Seniors on Steroids — Booking & Scheduling Platform

A full-featured appointment booking and business management web app built with React 19, TypeScript, Vite, Tailwind CSS v4, and Zustand. Designed for a senior fitness/wellness service provider.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| State management | Zustand 5 |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Calendar UI | react-big-calendar |
| Payments | Stripe (@stripe/react-stripe-js) |
| Notifications | react-hot-toast |
| Date utilities | date-fns |

---

## Project Structure

```
src/
├── App.tsx                  # Routes + BrowserRouter setup
├── main.tsx                 # Entry point
├── types/
│   └── index.ts             # All shared TypeScript interfaces
├── store/
│   └── bookingStore.ts      # Zustand store (global state + actions)
├── services/
│   ├── api.ts               # Axios base client
│   ├── bookingService.ts    # Booking CRUD API calls
│   ├── bookingService.ts    
│   ├── calendarSyncService.ts
│   ├── mockData.ts          # Seed/demo data
│   ├── paymentService.ts    # Stripe payment helpers
│   ├── policyService.ts     # Rescheduling & cancellation policy logic
│   ├── reminderService.ts   # Reminder scheduling
│   ├── rescheduleService.ts # Reschedule token validation
│   ├── serviceService.ts    # Service catalog API
│   ├── slotService.ts       # Availability slot API
│   └── timezoneService.ts   # Provider timezone persistence
├── pages/
│   ├── BookingPage.tsx          # Public client booking flow
│   ├── BookingPoliciesPage.tsx  # Admin: configure reschedule/cancel policies
│   ├── CalendarSyncPage.tsx     # Admin: Google/iCal calendar sync
│   ├── RemindersPage.tsx        # Admin: reminder configuration
│   ├── ReschedulePage.tsx       # Public: client self-service reschedule/cancel
│   └── TimeZonePage.tsx         # Admin: provider timezone settings
└── components/
    ├── bookings/            # BookingsList, RescheduleModal, BookingCard
    ├── calendar/            # Calendar view with react-big-calendar
    ├── dashboard/           # Dashboard overview with stats
    ├── forms/               # Reusable form fields
    ├── layout/              # AppLayout, Sidebar, Header
    ├── payment/             # Stripe checkout components
    ├── reminders/           # Reminder UI components
    ├── slots/               # SlotManager for availability
    └── ui/                  # Generic UI primitives (Badge, Modal, etc.)
```

---

## Routes

| Path | Visibility | Description |
|---|---|---|
| `/` | Admin | Dashboard with booking stats and calendar |
| `/bookings` | Admin | Full bookings list with filters |
| `/slots` | Admin | Manage available appointment slots |
| `/calendar-sync` | Admin | Sync with Google Calendar / iCal |
| `/reminders` | Admin | Configure automated client reminders |
| `/timezone` | Admin | Set the provider's display timezone |
| `/policies` | Admin | Configure reschedule & cancellation policies |
| `/book` | Public | Client-facing booking page |
| `/book/:serviceId` | Public | Client booking pre-loaded for a specific service |
| `/reschedule/:token` | Public | Client self-service reschedule or cancel |

---

## Features Built

### 1. Booking Flow
- Multi-step client booking: service selection → date/slot picker → form → Stripe payment
- Zod-validated forms with React Hook Form
- Booking confirmation with summary

### 2. Dashboard
- Live stats (today's bookings, revenue, upcoming, cancellations)
- Calendar view of all bookings via react-big-calendar
- Quick actions and recent bookings list

### 3. Slot & Availability Management
- Provider creates/deletes time slots
- Slots show occupancy status (available, booked, blocked)

### 4. Stripe Payments
- Stripe Elements embedded in the booking flow
- Payment intent creation via `paymentService.ts`
- Graceful handling of card errors

### 5. Automated Reminders
- Admin configures reminder rules (e.g., 24 h before appointment via SMS/email)
- `RemindersPage` with toggle, timing, and channel controls
- `reminderService.ts` persists rules to localStorage

### 6. Self-Service Rescheduling & Cancellations
- Clients receive a unique token link (`/reschedule/:token`)
- Policy rules enforced client-side:
  - Max reschedule count
  - Minimum notice window (hours before appointment)
  - Cancellation eligibility with tiered refund display
- Cancellation confirmation dialog showing applicable refund percentage
- Reschedule count tracked on each booking

### 7. Admin Booking Policy Configuration (`/policies`)
- Toggle reschedule on/off; set max attempts and notice hours
- Toggle cancellation on/off; set minimum notice hours
- Create/edit/remove refund tiers (hours threshold → refund %)
- Admin override flag (lets admins bypass policy limits)
- Live policy preview sidebar with plain-English rule summary

### 8. Admin Reschedule Modal
- Admins can reschedule any booking from the dashboard
- Policy eligibility displayed inline
- Optional admin override checkbox (when policy permits)

### 9. Calendar Sync (`/calendar-sync`)
- Connect Google Calendar or iCal feed
- Bidirectional sync status display
- `calendarSyncService.ts` manages OAuth tokens and sync state

### 10. Timezone Management (`/timezone`)
- Provider sets their local timezone
- All appointment times displayed relative to provider's zone
- Persisted to localStorage via `timezoneService.ts`

---

## State Management

All global state lives in a single Zustand store (`src/store/bookingStore.ts`):

```
bookings[]         — all booking records
slots[]            — all available slots
services[]         — service catalog
reminders[]        — reminder configurations
calendarSync       — calendar connection state
providerTimezone   — IANA timezone string
policy             — BookingPolicy (reschedule/cancel rules)
```

Each slice has corresponding actions (e.g., `addBooking`, `rescheduleBooking`, `setPolicy`). Persistence is handled per-feature via localStorage (policy, timezone, reminders).

---

## Key Data Types (`src/types/index.ts`)

```typescript
Booking              — id, clientName, serviceId, slotId, status, rescheduleCount, ...
Slot                 — id, date, startTime, endTime, isBooked
Service              — id, name, duration, price, description
BookingPolicy        — rescheduleEnabled, maxReschedules, rescheduleNoticeHours,
                       cancellationEnabled, cancellationNoticeHours, refundTiers[], adminCanOverride
RefundTier           — hoursBeforeAppointment, refundPct, label
PolicyCheckResult    — eligible, reason?, warning?, refundPct?, refundLabel?
ReminderConfig       — channel, timing, enabled
CalendarSyncState    — provider, connected, lastSynced
```

---

## Policy Service (`src/services/policyService.ts`)

Pure TypeScript — no external dependencies.

| Function | Purpose |
|---|---|
| `loadPolicy()` | Read policy from localStorage (falls back to defaults) |
| `savePolicy(p)` | Persist policy to localStorage |
| `checkRescheduleEligibility(booking, policy)` | Returns `PolicyCheckResult` |
| `checkCancellationEligibility(booking, policy)` | Returns `PolicyCheckResult` with refund info |
| `getApplicableRefundTier(hoursLeft, tiers)` | Finds best matching refund tier |
| `getPolicySummaryLines(policy)` | Returns string[] for display in UI |

Default policy: 2 max reschedules · 24 h reschedule notice · 12 h cancel notice · 100% refund ≥ 48 h / 50% ≥ 24 h / 0% otherwise.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check + production build
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env.development` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3001
```

---

## Build Output

Last verified build: **850 modules**, built in ~623 ms, zero TypeScript errors.

```
dist/assets/index.css   ~53 kB  (gzip: ~10.6 kB)
dist/assets/index.js   ~704 kB  (gzip: ~208 kB)
```

---

## Development Process Summary

This application was built incrementally through an AI-assisted development workflow, with features added in logical layers:

1. **Foundation** — Vite + React + TypeScript + Tailwind v4 scaffold, Zustand store skeleton, shared types
2. **Core booking flow** — Service catalog, slot picker, booking form, Zustand state wiring
3. **Dashboard & calendar** — Stats cards, react-big-calendar integration, booking list with status badges
4. **Payments** — Stripe Elements embedded in multi-step booking form, payment intent flow
5. **Reminders** — Admin reminder configuration page, localStorage persistence, channel/timing controls
6. **Self-service rescheduling** — Token-based public reschedule page, RescheduleModal for admins, slot re-selection
7. **Calendar sync** — Google/iCal connection UI, sync status display, `calendarSyncService`
8. **Timezone management** — Provider timezone selector, IANA zone list, display formatting
9. **Flexible rescheduling & cancellation policies** — `policyService.ts`, `BookingPolicy` types, admin config page, client-facing enforcement, tiered refunds, admin override

Each feature was validated with a TypeScript build check before moving to the next.
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
