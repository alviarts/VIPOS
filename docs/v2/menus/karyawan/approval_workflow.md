# Alur Kerja Persetujuan (Approval Workflow)

> Multi-step approval chains for purchase orders, financial transactions, etc.

`[Prime+]`

## §1 Persetujuan Pembelian

URL: `approval-workflow/purchase`

Configure approval chain for purchase orders.

Example chain:
```
Stock Manager creates PO
  ↓ approve
Operations Manager
  ↓ approve (if PO > 5M)
Finance Manager
  ↓ approve (if PO > 25M)
Director
  ↓ approve
PO posted to supplier
```

UI:
- Define chain steps (nodes).
- Per node: role/employee, approval threshold (amount range), required boolean.
- Chain selection: by category, by amount, by outlet.

When a PO is submitted:
- Server selects matching chain.
- First approver gets push notification.
- Each approver sees pending PO with "Approve / Reject / Comment".
- Reject → returns to creator with comment.
- All approve → PO becomes ACTIVE.

## §2 Persetujuan Keuangan

URL: `approval-workflow/finance`

Same pattern for financial txns:
- Cash payments
- Cash drops / pickups
- Manual journal entries
- Refunds above threshold

## §3 Mobile considerations

- Approver receives push: "Persetujuan baru menunggu — PO #123 dari Andi, Rp 7.500.000".
- Tap → opens approval screen with details + Approve/Reject buttons.
- Action requires PIN re-entry.
- Approval works offline (queue, syncs on reconnect — but document waits).

## §4 API

- `GET/POST /api/v1/approval-chain`
- `POST /api/v1/approval/:doc_type/:doc_id/approve`
- `POST /api/v1/approval/:doc_type/:doc_id/reject`
- `GET /api/v1/approval/pending?approver=`

## §5 Open questions

- Delegate approval (manager on leave)? `[inferred]` should be supported.
- Parallel approval (any-of-N approves)? `[unknown]`
- Auto-escalation if approver unresponsive for X hours? `[unknown]`
