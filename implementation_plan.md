# Goal Description

Implement a "Scan QR" feature in the mobile navigation bar for students. This feature will open a dedicated QR scanner page that allows students to:
1. **Scan a Bus QR**: Automatically opens the seat selection panel for that bus/shift.
2. **Scan a Seat QR**: Instantly marks attendance for that specific seat and boards the student.

This streamlines the boarding process and aligns with our professional, simple, and modern design standards.

## User Review Required

> [!IMPORTANT]
> **Product Flow Changes:**
> 1. Previously, scanning a `BUS_QR` would directly board the student. Now, scanning a `BUS_QR` will redirect the student to the **Seat Selection Panel** for that bus, allowing them to pick their seat interactively.
> 2. We are introducing a new QR type: `SEAT_QR`. When scanned, this will instantly board the student and mark attendance for that specific seat. This implies that physical QR codes will need to be placed on individual seats inside the bus.

## Open Questions

> [!WARNING]
> Do you want the `SEAT_QR` to override any existing seat booking the student might have made? If a student booked Seat 4 but sits in Seat 12 and scans the QR for Seat 12, should the system update their booking to Seat 12 and mark them present?

## Proposed Changes

---

### UI Navigation

#### [MODIFY] [`MobileBottomNav.tsx`](file:///Users/adityapandeydev/Desktop/campusFleet/src/components/common/MobileBottomNav.tsx)
- Add a prominent "Scan QR" button in the center of the mobile bottom navigation bar (only visible when `isPaymentApproved` is true).
- Use a distinct styling (e.g., floating action button style or a distinct color) to make it easily accessible.

---

### Feature Pages & Components

#### [NEW] [`page.tsx`](file:///Users/adityapandeydev/Desktop/campusFleet/src/app/portal/scan/page.tsx) (in `src/app/portal/scan`)
- Create a new full-screen page dedicated to the QR scanner.
- Use `jsQR` and `navigator.mediaDevices.getUserMedia` for real-time 60 FPS scanning (similar to the existing `StudentSelfScanner`).
- Implement the routing logic:
  - If `payload.type === "BUS_QR"`: Extract `busId` and redirect to `/portal?busId={busId}`.
  - If `payload.type === "SEAT_QR"`: Call the boarding API, show a success animation, and redirect to the Digital Pass view.

#### [MODIFY] [`UnifiedCommuteHub.tsx`](file:///Users/adityapandeydev/Desktop/campusFleet/src/components/portal/UnifiedCommuteHub.tsx)
- Add support for reading `busId` from the URL query parameters.
- If a `busId` is present in the URL, automatically skip the `CommuteBusSelector` and jump straight to the `ShiftBookingView` (seat selection panel) for that bus.

---

### Backend API

#### [MODIFY] [`route.ts`](file:///Users/adityapandeydev/Desktop/campusFleet/src/app/api/students/board-self-service/route.ts)
- Update the API to accept a `seatId` parameter.
- If `seatId` is provided, update the student's booking to reflect that specific seat before marking them as boarded.

## Verification Plan

### Manual Verification
1. Launch the app on a mobile device (or responsive mode).
2. Tap the new "Scan QR" button in the bottom navigation.
3. Show a generated `BUS_QR` to the camera; verify that it redirects to the seat selection map.
4. Show a generated `SEAT_QR` to the camera; verify that it marks attendance, shows a success message, and redirects to the Digital Pass.
