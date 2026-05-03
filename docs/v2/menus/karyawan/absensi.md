# Absensi (Attendance)

> Employee check-in / check-out tracking. Geo-fenced + biometric/face-rec.

## §1 Akses Absensi

URL: `employee/attendance-access`

Who can check-in via what device.

Per employee:
- Attendance methods enabled: GPS, Selfie, NFC, Manual
- Default outlet
- Allowed devices (specific terminal ids)

## §2 Radius Absensi

URL: `employee/attendance-radius`

Geo-fence config per outlet.

Fields:
- Outlet location (lat, lng — auto from outlet master, editable)
- Radius (default 100 m, range 50-500)
- Strict mode: require GPS within radius vs warn-only

When employee tries to check-in:
- App reads GPS.
- If within radius → allow.
- If outside → show warning + ask reason (e.g. "Off-site visit"); manager must approve.

## §3 Check-in flow (Mobile)

In Employee App ("majoo Teams"):

1. Open app → Home shows "Belum check-in hari ini" + button.
2. Tap "Check-in".
3. App requests location → reads GPS.
4. App opens camera → captures selfie (face recognition optional).
5. Submit → server logs.
6. UI shows "Check-in sukses 08:32. Lanjut bekerja!"

## §4 Check-out flow

Similar to check-in:
1. Tap "Check-out".
2. Selfie + GPS.
3. Submit.
4. App computes hours worked + late mins + overtime.

## §5 Late / overtime detection

Compared against shift schedule:
- On-time: within ±15 min of shift start
- Late: > 15 min after shift start
- Early: > 15 min before shift end
- Overtime: > 15 min after shift end

Configurable thresholds.

## §6 Manual entry

Manager can manually log attendance for:
- Forgotten check-in
- Off-site visit
- WFH

Requires approval workflow.

## §7 Reports

See `16_REPORTS_CATALOG.md` §29.

## §8 Mobile considerations

- Background location: NOT recommended (privacy + battery). Only request location at check-in moment.
- Selfie: store locally + upload (compressed to 400×400 JPEG).
- Offline check-in: queue with timestamp; sync on reconnect.
- Push notification for shift start reminder ("Shift mulai 08:00 — jangan lupa check-in!").

## §9 API

- `POST /attendance/api/v1/checkin` `{ employee_id, lat, lng, photo_url, ts }`
- `POST /attendance/api/v1/checkout` `{ employee_id, lat, lng, photo_url, ts }`
- `GET /attendance/api/v1/log?employee=&from=&to=`
- `POST /attendance/api/v1/manual` (manager)

## §10 Open questions

- Face recognition vs selfie-only: which is implemented? `[unknown]`
- NFC tag check-in: hardware support? `[unknown]`
- WFH (work-from-home) policy: GPS exempt? `[inferred]` should be configurable per employee/role.
