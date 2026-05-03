# LAYANAN (Value-Added Services)

## §1 Majoopay / QRIS majoo

URL: `pembayaran-digital/pengajuan-wallet`

Apply for Majoopay merchant account (Majoo's QRIS service).

### Application form
- Business info (auto-filled from profile)
- KTP scan
- NPWP scan
- Selfie + KTP
- Business location photo
- Bank account for settlement
- Estimated monthly volume
- T&C acceptance

### Status flow
- SUBMITTED → REVIEW → APPROVED / REJECTED
- Approval typically 3-5 business days.
- If approved: QRIS code generated + EDC option.

### After approval
- QRIS code printable / displayable.
- Per-tx MDR (e.g. 0.7%).
- Settlement T+1 to merchant bank.

## §2 Majoopay / Pengajuan EDC

URL: `pembayaran-digital/pengajuan-edc`

Apply for EDC machine (card payment terminal).

Similar flow to QRIS. Provides physical EDC unit; bank-issued.

## §3 Integrasi Satu Sehat

URL: `satu-sehat/setting`

Government healthcare integration (for clinics/pharmacies).

Sends healthcare transactions to Indonesian Ministry of Health's Satu Sehat platform.

Configuration:
- Connect to Satu Sehat
- Map products to ICD-10 codes
- Map procedures to KBLI codes
- Auto-sync setting

`[Verified]` Limited to healthcare-vertical merchants.

## §4 Aura - AI Asisten Manajer

URL: `wa-assistance-manager`

AI assistant accessible via WhatsApp.

Owner can chat with bot:
- "Berapa pendapatan hari ini?" → bot replies with KPIs
- "Top 5 produk minggu ini?" → bot replies
- "Stok rendah?" → bot replies with list

Provisioning:
- Connect WA number to Aura
- Bot has read-only access to merchant data

`[Prime+]`

## §5 Mobile considerations

- LAYANAN screens are mostly application forms + status check.
- Camera capture for KTP/NPWP photos.
- File upload for documents.
- Push notification on approval/rejection.
- Chat with Aura: in-app chat UI or redirect to WA.

## §6 API

- `POST /payment/api/v1/wallet/apply`
- `GET /payment/api/v1/wallet/status`
- `POST /payment/api/v1/edc/apply`
- `GET/POST /satu-sehat/api/v1/setting`
- `GET/POST /aura/api/v1/setting`

## §7 Open questions

- Aura LLM: in-house or 3rd-party (OpenAI, etc)? `[unknown]`
- Aura permission scope: read-only or can take actions (e.g. mark stock OOO)? `[inferred]` likely read-only initially.
