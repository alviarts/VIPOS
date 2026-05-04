# VIPOS — Pilot Recruitment Kit (alpha v0.0.1)

> Tanggal: 2026-05-04 · Untuk: alviarts/VIPOS · Pemakai: founder + tim outreach
>
> Kit ini siap dipakai hari ini untuk approach **5–10 calon alpha merchants**. Setelah `PR-1..PR-4` merge, signup → onboarding → seed sample data → dashboard sudah jalan e2e. Tinggal cari merchant beneran yang mau jadi guinea pig sambil dapet value.

---

## 0. Posisi VIPOS hari ini (apa yang udah jalan, apa yang belum)

**Yang udah jalan (alpha-ready):**

- Backend Phase 2 100% done: Postgres + multi-tenant RLS + audit log + BullMQ + observability + rate-limit + API versioning + backup/DR (auto-test recovery jalan tiap minggu).
- Frontend: Sentry error capture + error boundary, public signup di `/signup`, onboarding wizard di `/onboarding` dengan 3 preset (F&B / Retail / Salon), POS kasir, products, categories, customers, inventory, transactions, reports, finance, employees, appointments, marketing.
- Self-service signup full e2e: merchant daftar → otomatis ke wizard → pilih preset → seed 8 produk + 4 kategori → dashboard.

**Yang belum jalan (alpha tetap bisa):**

- PWA / offline mode — di-defer sampai 1–2 alpha merchants jalan biar offline-sync scope bener (bukan ngira-ngira).
- Email verification — di-defer karena audit explicit "DON'T block kasir use".
- Native mobile app — Phase 3, belum mulai.

**Implikasi buat pitch:**

- Jangan janjiin PWA / offline / native mobile dulu. Pitch: "browser-based POS yang complete + multi-tenant ready, lagi nyari 5 merchant buat shape v1.0."
- Jangan minta merchant yang TANPA internet stable — alpha ini online-only. Target: warung/toko/salon yang udah punya wifi atau hotspot HP.

---

## 1. Outreach script (WhatsApp + email)

### 1a. WhatsApp — first contact (cold)

Pakai ini ke kenalan UMKM yang udah pake POS lain (Majoo, Olsera, Moka, dsb) atau yang masih manual (excel / buku tulis).

```
Halo Pak/Bu [Nama],

Saya [Nama Anda] dari VIPOS — software kasir buat UMKM (warung makan,
toko sembako, salon, dll). Lagi cari 5 merchant buat program alpha
gratis selama 2 bulan.

Yang Anda dapet:
- Akun VIPOS Lite gratis 2 bulan (tanpa iklan, tanpa biaya transaksi)
- Setup gampang: daftar → pilih jenis usaha → langsung 8 produk contoh
  siap dipake (bisa di-edit semua)
- Saya bantu setup langsung via WhatsApp / video call kalau perlu
- Akses ke fitur Pro (laporan lengkap, multi-outlet) selama alpha

Yang saya minta:
- 30 menit obrolan tiap minggu selama 2 bulan: cerita apa yang work,
  apa yang stuck, fitur apa yang kurang
- Boleh cancel kapan aja, no pressure

Boleh saya kirim link signup? 5 menit aja prosesnya, langsung bisa
dipake hari ini.

Suwun, [Nama Anda]
```

**Variasi singkat (≤300 char, kalau lo gak punya banyak konteks dengan calon merchant):**

```
Halo [Nama], saya [Anda] dari VIPOS (software kasir UMKM). Lagi nyari 5
merchant buat alpha gratis 2 bulan. Setup 5 menit, ada preset F&B/Retail/
Salon. Tukeran 30 menit/minggu buat feedback. Boleh saya jelasin lebih
lanjut? Suwun.
```

### 1b. Email — first contact (formal)

Pakai ini ke calon merchant yang lebih senior atau B2B (franchise kecil, koperasi, dsb).

**Subject line options (pilih salah satu):**

- `[VIPOS] Tawaran alpha: software kasir gratis 2 bulan + dukungan setup`
- `[VIPOS] Cari 5 UMKM untuk pilot — gratis 2 bulan + akses fitur Pro`

**Body:**

```
Halo Pak/Bu [Nama],

Perkenalkan, saya [Nama Anda] — founder VIPOS. VIPOS adalah software
kasir berbasis web buat UMKM (warung makan, toko sembako, salon, dsb)
yang baru kami selesaikan v0.0.1.

Sebelum kami buka ke publik, kami sedang mencari 5 merchant alpha
yang bersedia jadi early adopter selama 2 bulan dengan benefit:

  • Lisensi VIPOS Lite gratis 2 bulan
  • Akses fitur Pro (laporan lengkap, multi-outlet, integrasi
    appointment) selama alpha
  • Setup dibantu langsung oleh tim teknis (WhatsApp / video call)
  • Sample data siap pakai sesuai jenis usaha (8 produk + 4
    kategori, semua bisa di-edit)
  • Prioritas request fitur — feedback Anda akan langsung mempengaruhi
    roadmap v1.0

Yang kami minta sebagai imbalan:
  • Sesi feedback 30 menit per minggu selama 2 bulan (via WA /
    video call)
  • Izin kami menulis case study singkat di akhir program (anonim
    boleh, no foto kalau Anda mau)
  • Komit pemakaian harian — minimal 5 transaksi / hari biar
    feedbacknya valid

Bisa kami kirim link signup? Setup hanya 5 menit dan langsung bisa
dipakai. Kalau Anda tertarik, balas email ini atau langsung ke
nomor saya: [+62-xxx-xxxx-xxxx].

Terima kasih sudah meluangkan waktu.

Salam,
[Nama Anda]
[Nama Anda] — Founder, VIPOS
[email] · [WhatsApp]
[website / link Linktree kalau ada]
```

### 1c. Follow-up (3 hari kemudian, kalau gak dibalas)

```
Halo [Nama], cuma mau follow up singkat aja — masih buka 5 slot
alpha VIPOS sampai akhir minggu ini. Kalau lagi sibuk no problem,
mungkin lain kali. Suwun!
```

### 1d. Onboarding link template

Begitu calon merchant jawab "tertarik", kirim ini:

```
Mantap, makasih [Nama]! Berikut langkahnya:

1. Buka https://[YOUR_DOMAIN]/signup
2. Isi: nama usaha, slug (otomatis tergenerate dari nama), nama
   admin, email (opsional), username, password (min 6 karakter)
3. Klik "Daftar" — otomatis masuk ke wizard onboarding
4. Pilih preset jenis usaha:
   - F&B (warung makan / kafe / kedai kopi)
   - Retail (toko sembako / minimarket)
   - Salon (salon / spa / barbershop)
   atau "Mulai dari kosong" kalau mau setup manual
5. Klik "Buat data contoh" → langsung dapet 4 kategori + 8 produk
   contoh yang bisa di-edit semua
6. Done — langsung bisa transaksi pertama

Setelah Anda daftar, kabari saya di WA — saya bantu walkthrough
fitur lain yang relevan (kasir, laporan, multi-outlet, dll) lewat
video call kapan Anda free.

Kalau ada apa-apa, langsung WA saya: [+62-xxx-xxxx-xxxx].
```

---

## 2. Welcome message — kirim setelah merchant signup

Sekarang VIPOS belum kirim email otomatis setelah signup (email verification di-defer). Lo kirim manual via WhatsApp setelah merchant selesai signup.

**Trigger:** lo lihat ada signup baru di Sentry / log / dashboard admin.

**Template (WhatsApp, 1 jam setelah signup):**

```
Halo [Nama Admin], selamat datang di VIPOS! 🎉

Saya [Nama Anda] dari tim VIPOS. Saya lihat Anda baru daftar dengan
slug "[tenant_slug]". Beberapa info awal:

✓ Akun Anda aktif — login di https://[YOUR_DOMAIN]/login
✓ Sample data sudah ter-load (kalau Anda pilih preset di wizard)
✓ Lisensi alpha aktif sampai [tanggal +60 hari]

3 langkah pertama yang saya saranin:
1. Edit harga produk contoh sesuai harga jual asli Anda
   (menu Produk → klik produk → edit harga)
2. Coba 1 transaksi di kasir (menu Kasir → pilih produk → bayar tunai)
3. Cek struk di menu Riwayat Transaksi

Saya mau bantu walkthrough lewat video call 30 menit minggu ini.
Kira-kira hari & jam apa yang cocok? (Senin–Sabtu, 9 pagi–9 malam,
cocok?)

Kalau ada error / nemu bug, langsung screenshot ke nomor ini ya.
Kami pakai sistem otomatis (Sentry) jadi kami juga akan dapet
notifikasi, tapi screenshot dari Anda lebih cepat ditangani.

Suwun udah join alpha 🙏
```

**Yang lo siapin sebelum kirim message ini:**

- [ ] Buka admin panel / Sentry buat verify tenant ter-create dengan benar
- [ ] Cek apakah onboarding wizard finished (lihat `tenants.metadata.onboarding_completed_at`)
- [ ] Cek count produk di tenant (kalau 0, tanya: "Anda pilih preset apa di wizard? Kelihatannya gak ke-load.")

---

## 3. Day-7 check-in script

**Trigger:** 7 hari setelah merchant signup (atau kalau aktivitasnya berkurang drastis).

**Format:** WhatsApp dulu (text-based, async-friendly). Kalau dia respon panjang, lanjut ke video call.

**WA opener:**

```
Halo [Nama], udah seminggu di VIPOS — gimana so far?

Saya mau nanya 5 hal cepet (boleh jawab text aja):

1. Berapa transaksi udah Anda input minggu ini? (kira-kira aja)
2. Fitur yang paling sering Anda pake apa?
3. Ada step yang stuck / bingung gak?
4. Ada fitur yang Anda harap ada tapi belum ada?
5. Skala 1-10, seberapa likely Anda recommend ke kenalan UMKM?

Boleh jawab satu-satu, gak harus sekaligus. Suwun! 🙏
```

**Tujuan tiap pertanyaan:**

| #   | Pertanyaan           | Buat ngukur apa                                                  |
| --- | -------------------- | ---------------------------------------------------------------- |
| 1   | Jumlah transaksi     | Apakah dia beneran pake atau cuma daftar doang?                  |
| 2   | Fitur paling sering  | Confirm value-prop alpha cocok atau enggak                       |
| 3   | Step stuck           | Concrete UX gap (yang kemungkinan besar bakal jadi follow-up PR) |
| 4   | Fitur yang harus ada | Concrete feature gap                                             |
| 5   | NPS                  | Quick health check — kalau <7, ada masalah serius                |

**Follow-up actions berdasarkan jawaban:**

- **Transaksi <5 / minggu:** offer 30 menit setup call ulang. Kemungkinan besar dia stuck di onboarding atau gak ngerti fitur kasir.
- **Stuck di step tertentu:**
  - "Gak ngerti cara tambah produk" → screenshare via Anydesk / Zoho Assist, walkthrough.
  - "Slow / lemot" → minta dia screenshot waktu loading + browser console (F12 → Console). File issue.
  - "Print struk gak jalan" → known scope (printer integration belum complete) → log as feature request.
- **Fitur missing yang concrete + reasonable** (e.g. "import produk dari excel"): log di backlog dengan tag `pilot-request:[merchant-name]`. Kalau >2 merchant minta hal sama, prioritize.
- **NPS <7:** schedule 30 menit video call buat dig deeper. Kemungkinan besar churn risk.

---

## 4. Pilot success criteria

**Apa definisi "alpha sukses"?** Pakai 4 metric ini per-merchant.

| Metric                 | Target                                                                         | Cara cek                                                                              |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Activation rate**    | Merchant complete onboarding wizard + minimal 1 transaksi dalam 7 hari pertama | Cek `tenants.metadata.onboarding_completed_at` + `COUNT(*)` `transactions` per tenant |
| **Daily active usage** | Minimal 5 transaksi / hari, minimal 5 hari / minggu                            | Audit log + transactions table                                                        |
| **Retention**          | Masih aktif transaksi di week 8                                                | Compare last_transaction_at di week 1 vs week 8                                       |
| **NPS**                | ≥7 di day-7 check-in dan ≥8 di day-30 check-in                                 | WA-based survey                                                                       |

**Sukses overall (ready buat beta launch):**

- ≥3 dari 5 merchant lulus semua 4 metric
- ≥2 churn yang merchant **mau jelaskan kenapa** (signal yang concrete, bukan ghosting)
- ≥10 unique bug reports (means: ada usage real, bukan smoke)
- ≥5 unique feature requests yang concrete + actionable
- 0 data loss / data leak antar tenant (RLS holds in production)

**Failure signals (perlu rethink):**

- 5/5 merchant churn dalam 2 minggu pertama
- Banyak yang complain "ribet" / "butuh training" → UX issue di onboarding
- 0 transaksi dari semua merchant setelah 1 minggu → activation broken
- Sentry: ratio error >5% → reliability issue

---

## 5. Operasional checklist (lo hari ini)

Sebelum kirim outreach pertama:

- [ ] Deploy backend + frontend ke production / staging dengan domain yang accessible
- [ ] Set `VITE_SENTRY_DSN_FRONTEND` env di build — biar Sentry capture client errors
- [ ] Test end-to-end signup flow sendiri: `/signup` → `/onboarding` → seed → `/dashboard` → kasir → 1 transaksi → laporan
- [ ] Siapin link Linktree atau landing page sederhana (1 halaman aja, ngejelasin VIPOS) — atau pake Notion public page kalau nyari yang fastest
- [ ] Siapin nomor WhatsApp dedicated buat alpha (boleh nomor Anda kalau belum ada nomor terpisah)
- [ ] Bikin spreadsheet tracking 5–10 calon merchant: nama, kontak, tanggal kirim outreach, status, signup atau enggak, last activity
- [ ] Set reminder buat day-7 check-in di calendar (per-merchant, 7 hari setelah signup)

Daftar 10 calon merchant yang gampang dihubungi dulu (template — isi sendiri):

| #   | Nama Usaha | Owner | Kontak | Jenis usaha | Status       | Tanggal outreach |
| --- | ---------- | ----- | ------ | ----------- | ------------ | ---------------- |
| 1   |            |       |        |             | belum kontak |                  |
| 2   |            |       |        |             | belum kontak |                  |
| 3   |            |       |        |             | belum kontak |                  |
| 4   |            |       |        |             | belum kontak |                  |
| 5   |            |       |        |             | belum kontak |                  |
| 6   |            |       |        |             | belum kontak |                  |
| 7   |            |       |        |             | belum kontak |                  |
| 8   |            |       |        |             | belum kontak |                  |
| 9   |            |       |        |             | belum kontak |                  |
| 10  |            |       |        |             | belum kontak |                  |

**Tip:** mulai dari **kenalan dekat** (keluarga, teman, kenalan founder lain). Conversion rate cold outreach UMKM biasanya 2–5%; warm outreach (kenalan + intro) bisa 30–50%.

---

## 6. Anti-patterns (jangan dilakukan)

**Jangan:**

- Spam group WhatsApp UMKM dengan template generic — instant churn signal & merusak reputasi.
- Ngajak merchant yang offline-only (warung di pasar tradisional tanpa wifi). Alpha ini online-only.
- Janjiin fitur yang belum ada (PWA / offline / native app / integrasi marketplace built-in). Pitch berdasarkan apa yang udah jalan aja.
- Ngebebanin merchant dengan SLA / uptime promise. Mereka adopter, bukan customer paid — mereka tau alpha berarti ada bug.
- Skip day-7 check-in. Ini momen paling kritis — kalau merchant gak ngomong di week 1, week 4 mereka udah ghost.
- Defensif waktu nerima feedback negatif. Tulis aja, tanya clarifying question, jangan justify ("oh tapi sebenernya itu by design"). Biarpun memang by design, signal dari merchant yang bilang "ribet" itu valid data.

**Boleh dilakukan:**

- Honest tentang status alpha. UMKM appreciate honesty — "ini lagi alpha jadi mungkin ada bug tapi kami responsif kalau ada masalah" lebih meyakinkan daripada janji surga.
- Bilang "saya gak tau" kalau nemu pertanyaan teknis aneh. Lo founder, bukan support generic.
- Refund / cabut akun kalau merchant jelas-jelas gak cocok. Lebih baik 3 merchant aktif yang bener-bener ngasih feedback daripada 10 merchant zombie.

---

## 7. Lampiran: copy-paste-ready quick links

**Buat lo (founder):**

- Sentry frontend: setelah `VITE_SENTRY_DSN_FRONTEND` di-set, dashboard di sentry.io
- Backup auto-test: cron `0 4 * * 0` UTC (Minggu 04:00) — cek metric `vipos_backup_restore_test_total{status}` di Prometheus / Grafana
- Audit log per tenant: query `SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`
- Delete a tenant (test only): `DELETE FROM tenants WHERE slug = $1` — hati-hati, RLS off untuk superadmin

**Buat merchant (kasih ke mereka):**

- Signup: https://[YOUR_DOMAIN]/signup
- Login: https://[YOUR_DOMAIN]/login
- Forgot password: https://[YOUR_DOMAIN]/forgot-password
- Help / FAQ: https://[YOUR_DOMAIN]/help (in-app)
- Feedback channel: https://[YOUR_DOMAIN]/help/feedback (in-app, P2-04)

---

## 8. Next iteration triggers (after pilot)

Setelah 2 bulan pilot, lo ada signal data buat decide arah next quarter:

- **Kalau ≥3 merchant retain + NPS ≥8:** beta launch — buka pendaftaran public, mulai charge VIPOS Lite tier (Rp X / bulan), keep alpha-pilot 5 gratis terus.
- **Kalau churn tinggi karena UX / activation:** prioritas frontend hardening (loading states, error UX polish, walkthrough video, FAQ).
- **Kalau churn tinggi karena offline:** prioritas PWA / offline MVP (yang di-defer).
- **Kalau request native mobile dominan:** Phase 3 (React Native / Capacitor wrapper). Audit dulu sebelum coding.
- **Kalau request integrasi marketplace dominan:** scope GoFood/GrabFood/ShopeeFood integration as standalone module.

---

_Tanya gw kalau lo butuh expand section tertentu (e.g. WhatsApp template buat segmen tertentu, copywriting alternatif, launch landing page draft, dst)._
