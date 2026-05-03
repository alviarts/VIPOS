# Jadwal Kerja (Work Schedule)

## §1 Daftar Shift

URL: `work-schedule/master-shift-list`

Define shift templates.

Fields:
- Shift name (e.g. "Pagi", "Sore", "Malam")
- Start time, end time
- Break time (e.g. 1 hr lunch)
- Work hours (auto)
- Color code

Examples:
- Pagi: 08:00-16:00 (1 hr break, 7 hr work)
- Sore: 14:00-22:00
- Malam: 22:00-06:00 (overnight)

## §2 Daftar Jadwal Kerja

URL: `work-schedule/master-schedule-list`

Define schedule templates (e.g. "Standard 5/2", "6/1", "Rotation").

Fields:
- Schedule name
- Pattern: which shifts on which days
- Cycle length (1 week, 2 weeks)
- Off days

## §3 Jadwal Kerja Karyawan

URL: `work-schedule/employee-schedule`

Assign schedule to employees.

UI:
- Calendar grid: rows = employees, cols = days, cells = shift code.
- Drag to assign / change.
- Bulk assign (e.g. "All cashiers in Outlet A get Schedule 5/2 starting Mon").

## §4 Shift swap

Employee A wants to swap shift with B:
1. A opens own shift in app.
2. Tap "Tukar Shift" → pick B + B's shift to swap with.
3. App sends approval request to B.
4. B approves → swap finalized + manager notified.
5. B rejects → A notified.

Manager can override.

## §5 Mobile considerations

- Employee App: see own schedule, request leave, request swap.
- Cashier App: cashier sees own shift on POS dashboard.
- Owner App: full schedule editor.
- Push notification 1 day before shift.

## §6 API

- `GET/POST /scheduling/api/v1/shift`
- `GET/POST /scheduling/api/v1/schedule`
- `GET/POST /scheduling/api/v1/employee-schedule?employee=&from=&to=`
- `POST /scheduling/api/v1/swap-request`

## §7 Open questions

- Auto-scheduling (algorithm fills shifts based on availability)? `[inferred]` likely manual; possible Prime+ feature.
- Holiday / time-off integration with payroll? `[inferred]` yes.
