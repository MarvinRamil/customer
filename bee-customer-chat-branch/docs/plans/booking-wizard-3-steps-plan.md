# Booking flow → 3-step wizard (UI only)

**Goal:** Turn the single booking screen into a **3-step booking wizard** that matches the designs in `UI/bee-booking-ui/`. **No API changes** — keep all existing hooks, validation, payment flow, and create-booking logic; only change how the UI is structured and navigated.

---

## 1. Reference designs (UI/bee-booking-ui)

### Step 1 – Route & vehicle (`create_booking_step_1_detailed_route_vehicle`)

- **Header:** Back, “Create Booking”, progress **Step 1 of 3** (3 segments, first filled).
- **Sections:**
  1. **Routes & Stops**
     - Pickup: address (with edit), Contact Name, Phone, Stop Notes.
     - Visual connector, then Dropoff: address (with add), Recipient Name, Phone, Stop Notes.
  2. **Vehicle Type**
     - “View Map” link.
     - Horizontal scroll of vehicle cards (icon, name, capacity, base price); selected = primary border/highlight.
  3. **Additional Services** (collapsible)
     - Document Handling, Toll Fees, Round Trip with checkboxes and prices.
- **Footer (sticky):** “Estimated Total” (e.g. PHP 110.00, tax inclusive) + primary CTA: **“Next: Cargo Details”**.

### Step 2 – Cargo details (`create_booking_step_2_cargo_details`)

- **Header:** Back, “Create Booking”, progress **Step 2 of 3** (first two segments filled).
- **Content:**
  - Title: “Cargo Details”, subtitle about assigning the right vehicle.
  - **Weight (KG)** – number input with “kg” suffix.
  - **Dimensions (Length × Width × Height)** – **three separate number fields** (Length, Width, Height), each with optional value in **cm**. UI only; not sent to API.
  - **Cargo Description** – textarea.
  - **Notes for Driver** – textarea.
  - **Tip (Optional)** – amount input with “₱” and quick buttons (e.g. ₱20, ₱50).
- **Footer:** “Estimated Total” (e.g. ₱345.00) + optional “Base: ₱325.00” + **“Next: Payment Method”**.

### Step 3 – Payment & summary (`create_booking_step_3_payment_summary`)

- **Header:** Back, “Create Booking”, progress **Step 3 of 3** (all segments filled).
- **Sections:**
  1. **Payment Method**
     - Radio options: Cash on Delivery, Bee Wallet, Credit/Debit Card (copy from design; app currently has “Cash” and “Pay online” — keep those, others can be disabled or visual-only).
  2. **Booking Summary**
     - Map preview area (optional).
     - Pickup / Dropoff addresses.
     - Vehicle type and **Total Fare**.
- **Footer:** “Amount to pay” + **“Confirm & Request Bee”**.

---

## 2. Current implementation (what to preserve)

- **File:** `app/booking.tsx` (single long screen).
- **Form:** `react-hook-form` + `bookingSchema` (Zod) from `features/bookings/schemas/validationSchemas.ts`.
- **State:** All existing state (pickup, dropoffs, truckType, isScheduled, scheduledDate/Time, description, notesForDriver, weight, tipAmount, tipMessage, itemImage, paymentMethod, etc.).
- **API/hooks:** No changes.
  - `useCalculateFare` – trigger when pickup, dropoffs, truckType, weight are valid; used for estimated total.
  - `useCreateMultiStopBooking` – create booking (Cash: direct; Pay online: after payment confirmed).
  - `useVehiclePricing` – vehicle options (with fallback).
  - Payment: `createPayment`, `linkPaymentToBooking`, `usePaymentStatus`, Pay online flow (open URL, wait for confirmation, then create booking).
- **Features to keep:** Map full-screen, location search (pickup/dropoff), date/time pickers for Scheduled, item image upload, validation, error handling, payment modals/overlays.

---

## 3. Wizard structure (3 steps)

| Step | Purpose | Content (from current screen) | Footer CTA |
|------|---------|-------------------------------|------------|
| **1** | Route & vehicle | Routes & Stops (pickup + dropoffs, contacts, notes), Vehicle Type carousel, Service & Timing (On Demand / Scheduled + date/time), optional “Additional Services” (can be placeholder) | “Next: Cargo Details” |
| **2** | Cargo details | Weight, **Dimensions** (Length, Width, Height – separate number fields, cm), Cargo Description, Notes for Driver, Tip (amount + quick buttons), Tip message, **Item Image** (keep required) | “Next: Payment Method” |
| **3** | Payment & confirm | Payment method (Cash / Pay online), Booking summary (route, vehicle, total), optional map preview | “Confirm & Request Bee” |

- **Progress indicator:** “Step X of 3” + 3 segments (filled up to current step), matching the UI ref.
- **Back:** Step 2 → Step 1, Step 3 → Step 2; on Step 1, Back can go to previous app screen (e.g. tabs).
- **Validation:**
  - **Step 1:** Require pickup, at least one dropoff with address, truckType; if Scheduled, require date/time. Optionally require coordinates (or keep current behavior).
  - **Step 2:** Require weight if schema says so; item image required (current behavior).
  - **Step 3:** No extra validation; final submit runs existing `onSubmit` (Zod + existing checks).

---

## 4. Implementation plan

### 4.1 State and layout

- Add **wizard step state** in `app/booking.tsx`: e.g. `const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)`.
- Keep a **single** `ScrollView` (or one per step) and **conditional rendering** by `wizardStep`:
  - `wizardStep === 1` → render Step 1 content (route, vehicle, service/timing).
  - `wizardStep === 2` → render Step 2 content (cargo fields, item image).
  - `wizardStep === 3` → render Step 3 content (payment method, summary).
- **Single form** for the whole flow; do not reset form between steps (only on successful submit or explicit “start over”).

### 4.2 Shared header

- Sticky header on all steps:
  - Back: if step > 1, `setWizardStep(step - 1)`; if step === 1, `router.back()` or navigate to tabs.
  - Title: “Create Booking”.
  - Progress: “Step X of 3” + three segment bars (e.g. filled for 1..X, muted for the rest). Reuse design from `code.html` (flex gap, rounded bars, primary vs primary/20).

### 4.3 Step 1 – Route & vehicle

- **Routes & Stops:** Reorder or restyle to match UI ref (pickup block with edit, connector, dropoff block(s) with add). Keep existing:
  - Pickup/dropoff address inputs, map/search, `Controller` for pickup, dropoffs, contact names, phones, notes.
  - Full-screen map and place selection logic unchanged.
- **Vehicle Type:** Keep current carousel (from API or fallback). Add “View Map” that opens the same full-screen map if desired.
- **Service & Timing:** Keep On Demand / Scheduled toggle and scheduled date/time/pickup window (and existing date/time pickers).
- **Additional Services:** Optional. Either hide or add a collapsible section with placeholder options (no API until backend supports it).
- **Footer:** Sticky bar with:
  - “Estimated Total” from `fareResult?.totalFare` (or “Calculating…”, or “Enter pickup, dropoff & vehicle”).
  - Button “Next: Cargo Details” → validate step 1 (pickup, dropoffs, truckType, schedule if needed); if valid, `setWizardStep(2)`.

### 4.4 Step 2 – Cargo details

- **Content:** Weight, **Dimensions**: three separate number inputs (Length, Width, Height in cm), Cargo Description, Notes for Driver, Tip (amount + quick ₱20/₱50 etc.), Tip message, Item Image. Reorder/label to match Step 2 design (e.g. “Cargo Details” title, “Notes for Driver”, “Tip (Optional)” with badge).
- **Footer:** “Estimated Total” (and optional “Base: …”) + “Next: Payment Method” → validate step 2 (e.g. weight, item image); if valid, `setWizardStep(3)`.

### 4.5 Step 3 – Payment & summary

- **Payment Method:** Keep existing Cash / Pay online radios (and any saved-method UI commented out). Optionally add Bee Wallet / Credit-Debit as disabled or for future.
- **Booking Summary:** New card showing:
  - Pickup and dropoff address(es) (read-only from form).
  - Vehicle type and total fare (`fareResult.totalFare`).
  - Optional: small map preview (reuse MapView or static image) if easy.
- **Footer:** “Amount to pay” + “Confirm & Request Bee” → call **existing** `handleSubmit` (same `onSubmit` as today). No API changes; payment flow (Pay online vs Cash) unchanged.

### 4.6 Fare calculation and bottom bar

- **When to run calculate fare:** Keep current logic (e.g. when pickup, dropoffs, truckType, weight are valid). Fare can be calculated already on Step 1 once route + vehicle are set; same `fareResult` used on Steps 2 and 3.
- **Bottom bar:** Shown only on the step that has the primary CTA (or show on all steps with step-specific label). Prefer one sticky footer per step as in the UI ref.

### 4.7 Modals and global UI

- **Map full-screen, date/time pickers, payment “waiting” overlay, success/error alerts:** Keep as-is; they can open from Step 1 (map, schedule) or Step 3 (submit). No changes to `usePaymentStatus`, `createdPaymentId`, or `pendingBookingData` logic.

### 4.8 Styling

- Align with `UI/bee-booking-ui`: primary color `#ffcd38`, section cards (white/dark surface), rounded corners, labels uppercase/small where specified, sticky footer with border-top and shadow.
- Reuse or adapt existing `StyleSheet` entries; add new styles for progress bar, step-specific footers, and summary card.

---

## 5. What not to change

- **APIs:** No new endpoints; no changes to `useCalculateFare`, `useCreateMultiStopBooking`, `useVehiclePricing`, or payment services.
- **Validation schema:** Keep `bookingSchema` and existing Zod rules.
- **Submit payload:** Same `CreateMultiStopBookingRequest` and payment flow (createPayment → linkPaymentToBooking or create booking after payment).
- **Navigation entry:** Booking screen still reached the same way (e.g. from tabs); only internal navigation is step-based.

---

## 6. Suggested order of work

1. Add `wizardStep` state and step-based rendering (three blocks); shared header with back + “Create Booking” + “Step X of 3” and progress segments.
2. Step 1: Move/reorder Route & Stops, Vehicle Type, Service & Timing into Step 1 block; add Step 1 footer and “Next: Cargo Details” (with step 1 validation).
3. Step 2: Move Cargo Details + Item Image into Step 2 block; add Step 2 footer and “Next: Payment Method” (with step 2 validation).
4. Step 3: Payment method + Booking Summary card; footer “Confirm & Request Bee” wired to existing `handleSubmit`.
5. Polish: Progress bar styling, optional “Additional Services” placeholder, “View Map” on Step 1, optional map in summary; ensure keyboard/scroll behavior and safe area.

This keeps all behavior and APIs intact while matching the 3-step wizard UI from `UI/bee-booking-ui`.
