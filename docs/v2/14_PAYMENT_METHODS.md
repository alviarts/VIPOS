# 14 · Payment Methods

> Cash, EDC card, QRIS static, QRIS dynamic, e-wallet, deposit, voucher, transfer, credit. Each has its own UX + reconciliation flow.

## §1 Method inventory

| Method | Code | Online req | MDR | Settlement |
|---|---|:-:|:-:|---|
| Tunai (cash) | `CASH` | No | 0 | T+0, in drawer |
| Kartu Debit / Kredit (EDC) | `EDC` | No (manual) / Yes (ECR) | 0.15 - 2.5 % | T+1, batch settle to bank |
| QRIS Statis | `QRIS_STATIC` | No (verify after) | 0.3 - 0.7 % | T+1 |
| QRIS Dinamis | `QRIS_DYNAMIC` | Yes | 0.3 - 0.7 % | T+1 |
| GoPay | `GOPAY` | Yes | 1.5-2 % | T+1 |
| OVO | `OVO` | Yes | 1.5-2 % | T+1 |
| DANA | `DANA` | Yes | 1.5-2 % | T+1 |
| ShopeePay | `SHOPEEPAY` | Yes | 1.5-2 % | T+1 |
| LinkAja | `LINKAJA` | Yes | 1.5-2 % | T+1 |
| Transfer Bank | `BANK_TRANSFER` | No (manual verify) | 0 - flat fee | Manual reconcile |
| Credit (piutang) | `CREDIT` | No | 0 | Receivable |
| Deposit (saldo customer) | `DEPOSIT` | No | 0 | Internal |
| Voucher / Kupon | `VOUCHER` | No | 0 | Internal |
| Loyalty Point | `LOYALTY_POINT` | No | 0 | Internal |
| Custom (other) | `OTHER` | No | 0 | Manual |

## §2 Cash flow

UX:
1. Cashier enters tendered amount (manually or quick-buttons: 50k/100k/exact).
2. App computes change.
3. Tap "Bayar" → opens drawer + prints receipt.
4. If `tendered < total`, cashier can switch to split (e.g. 50k cash + 21k QRIS).

Quick-amount keyboard: 1k, 5k, 10k, 20k, 50k, 100k, exact, +1k, +10k, +50k.

Don't allow tendered < total. Don't allow negative amounts.

Tax: cash payment doesn't affect tax base.

## §3 EDC manual mode

UX:
1. Cashier taps "EDC".
2. Selects bank (BCA / BRI / Mandiri / etc).
3. Picks card type (Debit / Kredit).
4. App shows total to charge.
5. Cashier processes on EDC manually.
6. After EDC prints, cashier enters:
   - Approval / ref number (required)
   - Last 4 digits of card (optional)
7. Tap "Konfirmasi" → save TransactionPayment.

## §4 EDC ECR mode

(See `08_HARDWARE_INTEGRATION.md` §7)

UX:
1. Cashier taps "EDC".
2. App sends amount to EDC via cable.
3. Customer dips/taps card on EDC.
4. EDC processes.
5. EDC sends ack back to app: success/decline + ref + card type + last 4.
6. App auto-saves payment.
7. App prints receipt.

ECR mitigates wrong-amount errors and ref typos.

## §5 QRIS Statis

Each outlet has a single static QR (printed on a placard at the cashier).

UX:
1. Cashier taps "QRIS Statis".
2. Customer scans the placard QR with their banking/e-wallet app.
3. Customer pays the exact amount.
4. Customer shows their app's success screen to cashier (or QRIS sound box plays).
5. Cashier taps "Bayar Selesai" to confirm.
6. App saves payment.

Limitation: no automatic verification. Cashier could accept fake screenshots. Fraud risk.

To mitigate: integrate with QRIS reconciliation API (some banks expose). For MVP, manual confirm is acceptable.

## §6 QRIS Dinamis

Per-transaction QR generated for the exact amount. Auto-verified.

UX:
1. Cashier taps "QRIS Dinamis".
2. App requests QR from gateway:
   ```
   POST /api/v1/payment/qris/dynamic
   { "transaction_id": 123, "amount": 71000 }
   → { "qr_code_url": "...", "ref_id": "QR123", "expires_at": "...", "polling_url": "..." }
   ```
3. App displays QR on screen (and optionally on customer display).
4. Customer scans + pays.
5. App polls `/api/v1/payment/qris/:ref_id/status` every 2 s.
6. On `PAID` → save payment, print receipt.
7. On timeout (5 min) → "QRIS kedaluwarsa, buat ulang?".

Or use webhook + FCM push for instant notify (preferred).

## §7 E-wallet (GoPay/OVO/DANA/ShopeePay/LinkAja)

Two flavours:
- **Open API** (GoPay Open API, etc) — generates a deeplink + QR; auto-verifies.
- **OTC kasir** — cashier uses provider's POS app; manually enters ref.

For VIPOS, recommend **QRIS Dinamis** as the universal channel — it's standardised and works for all e-wallets. Skip per-wallet integrations unless merchant specifically wants it.

## §8 Bank transfer

UX:
1. Cashier taps "Transfer".
2. Picks bank account (showing account number).
3. Customer transfers manually.
4. Cashier verifies via mutasi rekening (manual).
5. Enters ref + tap "Konfirmasi".

Risky for unknown customers. Common only for known repeat customers / B2B.

## §9 Credit (piutang)

UX:
1. Cashier taps "Piutang".
2. Selects customer (must exist; can't piutang walk-in).
3. App creates AR Invoice with due date (configurable).
4. Transaction marked as PAID-VIA-CREDIT.
5. Customer's balance increases.
6. When customer eventually pays, link to invoice + receive payment.

Customers with overdue invoices: warn cashier before extending more credit.

## §10 Deposit / saldo customer

UX:
1. Cashier taps "Deposit".
2. App shows customer's deposit balance.
3. Cashier enters amount to deduct.
4. If `amount > balance` → "Saldo tidak cukup".
5. Tap "Konfirmasi" → balance decreases.

Top up:
- Cashier taps "Top Up Deposit" (separate flow, not at POS).
- Selects customer + amount + payment method (cash/EDC/QRIS).
- Top-up creates a `Deposit` entry + payment.

## §11 Voucher

UX:
1. Cashier taps "Voucher".
2. Enters or scans voucher code.
3. App validates (online); cached if offline.
4. On valid → applies as a payment line (not discount).
5. Marks voucher as used after settle.

## §12 Loyalty point as payment

Some merchants treat point redemption as payment, not discount.
- 100 pts = Rp 5.000 (configurable).
- Customer's point balance reduces.
- Tax base doesn't change (already paid).

VIPOS recommendation: treat as **discount** (reduces tax base), not payment. Simpler tax accounting. Configurable per merchant.

## §13 Split payment

Customer pays part cash, part QRIS. Configurable max split methods (default 4).

UX:
1. After cart finalized, total shown.
2. Cashier enters first method + amount.
3. Remaining shown.
4. Cashier enters second method + amount.
5. Repeat until remaining = 0 or change due.
6. Submit → all payments saved as TransactionPayment rows.

Math:
```
sum(payments) - change == total
```

## §14 Round-the-payment

For cash, allow customer to round payment (e.g. total 71.300, customer hands 80.000, change 8.700). Show keyboard with quick "exact" / "+1k" / "+10k" / "+50k" / "+100k" buttons.

## §15 Payment cancellation

After cashier presses "Bayar", payment is locked. To cancel:
- For unsettled transactions: void the entire transaction (manager PIN).
- For QRIS dynamic awaiting payment: tap "Batalkan" → server cancels QR.
- For ECR EDC: not always possible — call customer service.

## §16 Reconciliation

End of day, daftar pembayaran:
- Cash counted vs cash sales (variance to investigate)
- EDC settled to bank vs EDC log in app (match by ref)
- QRIS settled to bank vs QRIS log in app
- E-wallet settled to merchant accounts
- Net deposit movement
- Credit (piutang) outstanding balance change

Generate "Laporan Tutup Kasir" PDF/CSV.

## §17 MDR (Merchant Discount Rate)

MDR is the fee charged by the payment processor.
- For cash: 0.
- For EDC: 0.15-2.5% per swipe (varies by card type and bank).
- For QRIS: 0.3-0.7% (regulated).
- For e-wallet: 1.5-2.0%.

App should record `mdr_amount` per payment (computed by gateway, returned in webhook). Reports show:
- Gross sales by method
- MDR by method
- Net settle to merchant

## §18 Settlement timing

| Method | Net settle |
|---|---|
| Cash | T+0 in drawer |
| EDC | T+1 next business day |
| QRIS | T+1 next business day |
| GoPay | T+1 |
| OVO | T+2 |
| DANA | T+1 |
| ShopeePay | T+1 |
| Bank transfer | Real-time (BI-FAST) or T+0 |

VIPOS app should fetch settlement status from gateway daily and reconcile.

## §19 Test plan

- Cash payment: tendered = total → 0 change.
- Cash payment: tendered > total → correct change.
- Cash payment: tendered < total → blocked.
- EDC manual: enter ref no, save.
- EDC manual: skip ref no → blocked.
- QRIS dynamic: poll until paid.
- QRIS dynamic: timeout after 5 min → option to regen.
- QRIS dynamic: customer scans + pays → app receives webhook → auto-mark paid.
- E-wallet via QRIS: same as QRIS.
- Deposit: balance 50k, deduct 60k → blocked.
- Deposit: balance 50k, deduct 30k → succeeds, balance 20k.
- Credit: cashier picks new customer → blocked (need to add customer first).
- Split: 50k cash + 21k QRIS = 71k total → both saved.
- Split: 50k cash + 30k QRIS for 71k total → change 9k → split shows the change against last method.
- Loyalty redeem: 100 points = 5k off → applied as discount → balance reduces by 100.
- Voucher: valid code → applied as payment.
- Voucher: already-used code → rejected with msg.
