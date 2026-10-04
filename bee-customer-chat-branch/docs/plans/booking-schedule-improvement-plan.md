# Booking Schedule Improvement Plan

## Overview

This plan improves how **schedule** and **service type** work on the booking screen: the UI will offer **On Demand** vs **Scheduled**, while the API continues to use `serviceType: "Immediate"` or `"Scheduled"`. When **On Demand** is selected, the pickup is as soon as possible (current date/time). When **Scheduled** is selected, the user picks a date and time and can optionally set a pickup window.

**Reference:** API contract is in `docs/lalamove-booking-api.md` (scheduleDate, serviceType, scheduledPickupWindow).

---

## Goals

1. **Default to On Demand** – Default is “as soon as possible”: `serviceType: "Immediate"`, `scheduleDate` = current date/time (booking time).
2. **Clear UI** – User chooses **On Demand** or **Scheduled** via a toggle (or equivalent). No “Immediate” in the UI; labels are **On Demand** and **Scheduled** only.
3. **Scheduled flow** – When **Scheduled** is on: show **Scheduled Date** and **Scheduled Time** (date + time pickers), and optional **Pickup window**.
4. **API unchanged** – Backend still receives `serviceType: "Immediate"` or `"Scheduled"` and `scheduleDate` (ISO). Optional `scheduledPickupWindow` when provided.

---

## Implementation Checklist

### Phase 1: State and Logic

- [x] Add `isScheduled: boolean` state (default `false`).
  - `false` = **On Demand** (UI) → send `serviceType: "Immediate"`, `scheduleDate` = `new Date().toISOString()`.
  - `true` = **Scheduled** (UI) → send `serviceType: "Scheduled"`, `scheduleDate` = user-selected date/time (ISO).
- [x] When **Scheduled**: add state for **Scheduled Date** and **Scheduled Time** (e.g. `scheduledDate: string` YYYY-MM-DD, `scheduledTime: string` HH:mm), default to today and a sensible time (e.g. 10:00).
- [x] When **Scheduled**: add optional state for **Pickup window** (e.g. `scheduledPickupWindow: string`) and send it only when the user fills it.
- [x] In submit handler:
  - If **On Demand**: `serviceType: "Immediate"`, `scheduleDate: new Date().toISOString()`; do not send `scheduledPickupWindow` (or send undefined).
  - If **Scheduled**: `serviceType: "Scheduled"`, `scheduleDate` = ISO from scheduled date + time; send `scheduledPickupWindow` if provided.
- [ ] Validation when **Scheduled**: require scheduled date and time, and ensure combined date/time is in the future before allowing “Confirm & book”.

**Status:** Not started

---

### Phase 2: Migrate to Zod Validation and React Hook Form

**Objective:** Migrate booking form from manual validation (`useState` + Alert checks) to Zod schemas + react-hook-form, per `.cursor/rules/validation/zod-validation.md`.

**Tasks:**

1. **Create Zod schema for booking form** ✅
   - Created `features/bookings/schemas/validationSchemas.ts`.
   - Defined `bookingSchema` with all fields:
     - `pickup` (required, string, trimmed)
     - `dropoffs` (array of `{ id: string; address: string; coordinates: LocationCoordinates | null }`, at least one with address)
     - `truckType` (required, string)
     - `isScheduled` (boolean)
     - `scheduledDate` (string with default '', required when `isScheduled` is true)
     - `scheduledTime` (string with default '', required when `isScheduled` is true)
     - `scheduledPickupWindow` (string with default '')
     - `description` (string with default '', trimmed)
     - `weight` (string with default '', validated as positive number if provided)
   - Used Zod refinements for conditional validation (`scheduledDate`/`scheduledTime` required when `isScheduled` is true).
   - Used Zod transforms for trimming.
   - Exported type: `BookingFormData = z.infer<typeof bookingSchema>`.

2. **Migrate form state to react-hook-form** ✅
   - Replaced `useState` for form fields with `useForm<BookingFormData>` from `react-hook-form`.
   - Used `@hookform/resolvers/zod` with `zodResolver(bookingSchema)`.
   - Used `Controller` for complex fields (pickup, dropoffs array, weight, description, scheduled fields).
   - Used `useFieldArray` for managing dropoffs array (appendDropoff, removeDropoff).
   - Used `watch()` for `isScheduled` and other form values for conditional logic.
   - Used `formState.errors` for field-level error display.

3. **Update validation logic** ✅
   - Replaced manual `handleSubmit` validation with `handleSubmit` from react-hook-form.
   - Created `onSubmit` callback that receives validated `BookingFormData`.
   - Removed most manual Alert-based validation; Zod handles form validation.
   - Kept API-level error handling (fare check, coordinates validation) separate from form validation.

4. **Update UI to use react-hook-form** ✅
   - Replaced `value={field}` / `onChangeText={setField}` with `<Controller>` for all form fields.
   - Display errors: `{errors.fieldName?.message && <Text>{errors.fieldName.message}</Text>}`.
   - For dropoffs array: using `useFieldArray` (dropoffFields, appendDropoff, removeDropoff).
   - For all inputs: using `Controller` with custom render function.

5. **Derive API payload from validated form data** ✅
   - In `onSubmit`: transforms `BookingFormData` to `CreateMultiStopBookingRequest`:
     - `isScheduled` → `serviceType: "Immediate" | "Scheduled"`.
     - `scheduledDate` + `scheduledTime` → `scheduleDate` (ISO) when Scheduled; current date/time when On Demand.
     - `dropoffs` → `stops` array (pickup + dropoffs).
     - `scheduledPickupWindow` → send only if provided (non-empty) and `isScheduled` is true.
     - `weight` → parsed to number if provided.

6. **Test and verify** ✅
   - All existing validation rules work (required fields, date/time validation, etc.).
   - Conditional validation (Scheduled fields required only when `isScheduled` is true).
   - Error messages display correctly (using `errors.fieldName?.message`).
   - Form reset after successful booking (using react-hook-form `reset()`).
   - No regressions in existing booking flow.

**Files created/modified:**
- ✅ `features/bookings/schemas/validationSchemas.ts` (created)
- ✅ `app/booking.tsx` (migrated to react-hook-form + Zod)

**Dependencies:**
- `zod` (already in package.json) ✅
- `react-hook-form` (already in package.json) ✅
- `@hookform/resolvers` (already in package.json) ✅

**Status:** ✅ Completed

---

### Phase 3: UI – Toggle and Labels

- [x] In the **LOGISTICS** section, added a control that lets the user choose between:
  - **On Demand** – "Pickup as soon as possible" (when toggle is off).
  - **Scheduled** – "Schedule pickup for a specific date and time" (when toggle is on).
- [x] Implemented **toggle (Switch)** so the choice is explicit.
- [x] Default selection: **On Demand** (`isScheduled = false`).
- [x] Do **not** show the word "Immediate" in the UI; only "On Demand" and "Scheduled".
- [x] Use react-hook-form `watch('isScheduled')` to conditionally show/hide Scheduled fields.

**Status:** ✅ Completed (implemented as part of Phase 2)

---

### Phase 4: UI – Scheduled Date and Time

- [x] When **Scheduled** is selected, show:
  1. **Scheduled Date** – Date picker or date input (e.g. YYYY-MM-DD). Label: “Scheduled Date”.
  2. **Scheduled Time** – Time picker or time input (e.g. HH:mm). Label: “Scheduled Time”.
- [x] When **On Demand** is selected, hide these fields (and do not use them for the request).
- [x] Build `scheduleDate` for the API by combining scheduled date + time into one ISO string (e.g. `new Date(\`${scheduledDate}T${scheduledTime}:00\`).toISOString()` or equivalent with timezone handling as needed).
- [x] Use react-hook-form `Controller` for date and time pickers if using custom picker components.

**Status:** ✅ Completed (implemented as part of Phase 2)

---

### Phase 5: UI – Optional Pickup Window

- [x] When **Scheduled** is selected, show an optional field:
  - Label: e.g. “Pickup window” or “Scheduled pickup window (optional)”.
  - Type: single line text (or time range if product defines a format).
- [x] Map this value to the API field `scheduledPickupWindow` and send it only when the user has entered something.
- [x] When **On Demand** is selected, do not show this field and do not send `scheduledPickupWindow`.

**Status:** ✅ Completed (implemented as part of Phase 2)

---

### Phase 6: Cleanup and Edge Cases

- [x] Remove or repurpose any old “Schedule Date”-only field that currently sends a fixed time (e.g. 10:00); replace with the new On Demand / Scheduled flow.
- [x] On success (after create booking), reset schedule-related state appropriately (e.g. reset to On Demand and clear scheduled date/time/pickup window).
- [x] Ensure safe area and theme are respected for any new or moved UI in the LOGISTICS section.

**Status:** ✅ Completed

---

## Summary Table

| UI choice   | API `serviceType` | API `scheduleDate`           | API `scheduledPickupWindow` |
|------------|--------------------|-----------------------------|-----------------------------|
| **On Demand** | `"Immediate"`      | Current date/time (now)     | Omit / undefined            |
| **Scheduled** | `"Scheduled"`      | User-selected date + time   | Optional, if user fills it  |

---

## Out of Scope (for this plan)

- Changes to calculate-fare request (e.g. optional `scheduledDateTime` for Scheduled) – can be a follow-up.
- Backend changes to accept new `serviceType` values; API remains `"Immediate"` | `"Scheduled"`.
- Changes to booking list or detail screens (e.g. how “On Demand” vs “Scheduled” is displayed there) – can be a separate plan.

---

## Dependencies

- **API:** Existing `POST /api/bookings/lalamove` with `scheduleDate`, `serviceType`, and optional `scheduledPickupWindow` as in `docs/lalamove-booking-api.md`.
- **App:** `app/booking.tsx` and `features/bookings` (types, service, hooks) – no new API endpoints required.

---

## Related Docs

- **API (schedule fields):** `docs/lalamove-booking-api.md`
- **Existing booking flow:** `docs/plans/lalamove-booking-implementation-plan.md`
