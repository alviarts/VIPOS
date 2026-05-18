# Phase 6: Go-to-Market

> Landing page, marketing site, beta merchant program, sales kit, public launch.
> Goal: VIPOS jadi commercially live, dengan 50+ paying merchant dalam 3 bulan.

**Estimasi total**: 4 minggu (6 tasks, paralel)

## Tasks

---

### P6-01: Landing page (vipos.id) `[pending]`

**Goal**: Marketing landing page profesional di domain `vipos.id`.

**Dependencies**: P1-01 (web layout shell)

**Outputs**:

- `apps/web-marketing/` (separate Next.js project untuk SEO + statis cepat)
- Sections: hero, problem, solution, features, pricing, testimonial, CTA
- Trial signup form (lead → backend)
- WhatsApp CTA chat
- Open Graph + meta tags
- Google Analytics + Hotjar

**Acceptance criteria**:

- [ ] Live di vipos.id
- [ ] Lighthouse score > 90 (Performance, SEO, Accessibility)
- [ ] Trial form submit → lead di backend
- [ ] WA CTA functional
- [ ] Multilingual (ID + EN)

**Branch**: `devin/P6-01-landing-page`
**Estimasi**: 5-7 hari

---

### P6-02: Pricing page + subscription self-service `[pending]`

**Goal**: Pricing tier (Lite, Starter, Advance, Prime, Prime+) dengan compare table + self-service signup → trial → paid.

**Dependencies**: P6-01, P2-02 (multi-tenant)

**Outputs**:

- Pricing page detailed
- Subscription flow: trial signup → payment (Midtrans/Xendit) → activation
- Invoice generation
- Trial reminder emails

**Acceptance criteria**:

- [ ] Compare table 5 tier dengan fitur per tier
- [ ] Trial 14 hari free
- [ ] Setelah trial, payment via Midtrans/Xendit
- [ ] Activation otomatis setelah payment success
- [ ] Email confirmation + invoice

**Reference**: `docs/v2/06_FEATURE_TIERS.md`

**Branch**: `devin/P6-02-pricing-subscription`
**Estimasi**: 6-7 hari

---

### P6-03: Help center + docs `[pending]`

**Goal**: Help center di `docs.vipos.id` — getting started, video tutorial, FAQ, troubleshooting.

**Dependencies**: P6-01

**Outputs**:

- Help center site (Docusaurus atau Mintlify)
- 30+ artikel: setup, fitur per modul, troubleshooting
- 10+ video tutorial (di-host di YouTube)
- Search functional

**Acceptance criteria**:

- [ ] Live di docs.vipos.id
- [ ] Setiap modul minimal 2 artikel + 1 video
- [ ] Search berfungsi
- [ ] Feedback widget per artikel ("Apakah artikel ini membantu?")

**Branch**: `devin/P6-03-help-center`
**Estimasi**: 7-10 hari (banyak content writing)

---

### P6-04: Beta program + onboarding kit `[pending]`

**Goal**: Recruit 50 beta merchant. Provide onboarding kit (training, hardware reference, support).

**Dependencies**: P3-22, P4-16

**Outputs**:

- Beta merchant landing form
- Onboarding email sequence (5 email × 7 hari)
- Hardware reference: list printer + scanner + tablet rekomendasi (link Tokopedia/Shopee)
- Setup video walkthrough
- WhatsApp support group
- Feedback survey monthly

**Acceptance criteria**:

- [ ] 50 merchant terdaftar
- [ ] Onboarding email rate open > 70%
- [ ] Setup video > 1000 view
- [ ] Avg time-to-first-transaction < 24 jam

**Branch**: `devin/P6-04-beta-program`
**Estimasi**: 5-7 hari (ongoing)

---

### P6-05: Sales kit + reseller program `[pending]`

**Goal**: Sales material (deck, brochure, demo video) + reseller partnership program.

**Dependencies**: P6-01

**Outputs**:

- Sales deck (Keynote/PowerPoint, 20 slide)
- Brochure PDF (1 page summary, 4 page detail)
- Demo video (5 menit walkthrough)
- Reseller portal (nama, kontak, komisi calculator)
- Reseller agreement template

**Acceptance criteria**:

- [ ] Sales deck siap (kualitas profesional)
- [ ] Brochure cetak-able
- [ ] Demo video upload ke YouTube (target 1000 view)
- [ ] Reseller portal live, 5 reseller terdaftar

**Branch**: `devin/P6-05-sales-kit`
**Estimasi**: 5-7 hari

---

### P6-06: Public launch + PR `[pending]`

**Goal**: Launch event (online/offline), PR di tech media, paid ads, content marketing kickoff.

**Dependencies**: P6-01..P6-05

**Outputs**:

- Launch event plan (online webinar atau offline di kota besar)
- Press release + media kit
- Paid ads (Facebook/Instagram + Google) Rp 5-10jt budget
- Content calendar (blog, IG, TikTok) 3 bulan ke depan
- Influencer outreach (UMKM influencer Indonesia)

**Acceptance criteria**:

- [ ] Event terselenggara (target attendee: 100 online / 50 offline)
- [ ] PR coverage minimal 3 outlet (DailySocial, Tech in Asia, dll)
- [ ] Ads campaign live, lead form filled > 200
- [ ] Content calendar published 30+ posts

**Branch**: `devin/P6-06-public-launch`
**Estimasi**: 7-10 hari

---

## Definition of Done — Phase 6

- [ ] vipos.id live + indexed di Google
- [ ] 50+ paying merchant dalam 3 bulan
- [ ] Beta program → graduated ke production
- [ ] Sales kit dipakai 5+ reseller
- [ ] Public launch sukses

Setelah Phase 6, VIPOS = produk komersial live, scaling secara organik + paid acquisition.

---

## Beyond Phase 6 (future considerations)

Setelah 6 phase selesai (~12-14 bulan), pertimbangan ekspansi:

| Initiative                                 | Estimasi   | Trigger                                  |
| ------------------------------------------ | ---------- | ---------------------------------------- |
| iOS app (Owner only)                       | 3 bulan    | Saat ada > 100 owner request iOS         |
| WhatsApp Business automated chatbot        | 2 bulan    | Setelah marketing automation matang      |
| Inventory ML demand forecasting            | 4 bulan    | Saat ada > 500 merchant data             |
| Open API + marketplace integrations        | 6 bulan    | Kebutuhan ekosistem partner              |
| Capital lending (Majoo Capital pattern)    | 6 bulan    | Setelah > 1000 merchant + financial data |
| Indonesia regional expansion (Vietnam, PH) | 6-12 bulan | Setelah PMF di Indonesia                 |

Tracked di `docs/v3/workflow/post_phase_6_roadmap.md` (akan dibuat saat phase 6 mendekati selesai).
