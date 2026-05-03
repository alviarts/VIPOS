# VIPOS Continuation Prompt — Single Universal Prompt

> **Inilah satu-satunya prompt yang Anda butuhkan.** Paste persis block ini ke session Devin baru setiap kali Anda mau lanjut development VIPOS. Devin akan auto-detect task berikutnya, eksekusi, commit incremental, dan buka PR.

## Cara pakai

1. Buka https://app.devin.ai → **New Session**
2. Paste block di bawah persis (jangan diubah) → kirim
3. Devin akan:
   - Baca workflow doc (`docs/v3/workflow/`)
   - Identify next task: yang berstatus `[pending]` dengan semua dependency `[done]`
   - Konfirmasi task ke Anda kalau ambiguous (multiple eligible tasks)
   - Eksekusi end-to-end
   - Commit + push **setiap milestone** (Anda bisa lihat progress real-time di GitHub branch)
   - Buka PR + mark task `[done]` di phase doc
   - Notify Anda saat selesai

## The prompt

```
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

Mode: AUTO-CONTINUATION. Pilih task next sendiri berdasarkan workflow doc.

LANGKAH 0 — Setup environment:
1. cd /home/ubuntu/repos/VIPOS && git fetch && git checkout main && git pull
2. Verify secrets tersedia: echo "GITHUB_PAT len=${#GITHUB_PAT}, VPS_PASSWORD len=${#VPS_PASSWORD}"
   (length > 0 berarti env vars terpasang). Kalau kosong, message user — JANGAN lanjut.
3. Install sshpass kalau belum (untuk akses VPS): sudo apt-get install -y sshpass

LANGKAH 1 — Identify next task:
1. Baca docs/v3/workflow/00_OVERVIEW.md (visi & arsitektur).
2. Baca docs/v3/workflow/01_HOW_TO_USE.md (konvensi).
3. Scan docs/v3/workflow/phase_*.md urut Phase 0 → 6:
   - Cari task pertama dengan status `[pending]`.
   - Verify semua dependency task itu sudah `[done]`.
4. Cross-check dengan git log + merged PR di https://github.com/alviarts/VIPOS/pulls?q=is%3Apr+is%3Amerged untuk konfirmasi state aktual sesuai marker.
5. Kalau ada selisih (e.g. task masih [pending] tapi PR sudah merged):
   - Update phase doc → mark [done] dulu.
   - Lanjut ke task berikutnya yang [pending].
6. Kalau ada > 1 task eligible (semua dependency done + status [pending]) di phase berbeda yang bisa paralel:
   - Pilih yang paling early phase (priority lebih tinggi).
   - Atau message user kalau ambiguous.

LANGKAH 2 — Verify task spec:
1. Baca task spec lengkap di phase doc.
2. Baca semua reference docs yang disebut (docs/v2/*.md).
3. Recap ke user: "Saya akan kerjakan {{task ID}}: {{title}}. Estimasi {{X}} hari. Ini acceptance criteria: ..."
   (NON-BLOCKING message, langsung lanjut tanpa tunggu balasan; user bisa interrupt kalau salah pilih.)

LANGKAH 3 — Eksekusi dengan commit incremental:
1. Buat branch: git checkout -b devin/{{task-ID}}-{{slug}}
2. Implement task per spec. **WAJIB commit + push setiap milestone**:
   - Setelah setup struktur awal (e.g. file/folder created)
   - Setelah implementasi backend selesai
   - Setelah implementasi frontend/mobile selesai
   - Setelah test pass
   - Setelah lint pass
   - Setelah dokumentasi update
   Format commit: "wip(P{X}-{nn}): {milestone}" untuk WIP, atau type konvensional saat selesai.
   Push setiap commit ke remote: git push origin devin/{{task-ID}}-{{slug}}
   Tujuan: user bisa monitor progress real-time di https://github.com/alviarts/VIPOS/commits/devin/{{task-ID}}-{{slug}}
3. Setelah semua acceptance criteria terpenuhi, commit final dengan message proper:
   "feat(P{X}-{nn}): {title}" (atau fix/chore/docs sesuai jenis task).

LANGKAH 4 — Test:
1. Lint: npm run lint (web/backend) atau ./gradlew ktlintCheck (Android, kalau ada)
2. Type check: tsc --noEmit (web/backend) atau gradle compile (Android)
3. Unit test: npm test atau ./gradlew test
4. Build: npm run build atau ./gradlew assembleDebug
5. Manual smoke test sesuai acceptance criteria.
6. Kalau ada regression, fix + commit.

LANGKAH 5 — Buka PR:
1. Push final: git push origin devin/{{task-ID}}-{{slug}}
   (Kalau 403 via Devin proxy, fallback: git push "https://x-access-token:${GITHUB_PAT}@github.com/alviarts/VIPOS.git" devin/{{task-ID}}-{{slug}})
2. Buat PR ke main pakai template docs/v3/workflow/templates/pr_template.md.
   Title: {type}(P{X}-{nn}): {title}
3. Wait CI pass (kalau sudah ada CI). Kalau gagal, fix + push commit baru.

LANGKAH 6 — Update phase doc + notify user:
1. Update docs/v3/workflow/phase_{X}_*.md → cari section task ID → ganti `[pending]` → `[done]`. Tambah baris:
   "PR: #N (merged YYYY-MM-DD), session: {{this devin session url}}"
2. Commit perubahan ini di branch yang sama (atau follow-up commit ke main setelah PR merged).
3. Notify user dengan link PR + summary perubahan + saran task berikutnya yang bisa dikerjakan.

KONVENSI YANG WAJIB DIIKUTI:
- Branch naming: devin/P{phase}-{nn}-{slug} (contoh: devin/P0-01-monorepo-setup)
- Commit message Conventional Commits: feat/fix/chore/docs/test/refactor/perf(P{X}-{nn}): description
- PR title: {type}(P{X}-{nn}): {title}
- PR body: ikuti template docs/v3/workflow/templates/pr_template.md
- Squash merge ke main; branch delete setelah merge.
- VIPOS standalone — tidak proxy ke Majoo, hanya pinjam pola UI/struktur API.
- JANGAN push langsung ke main — selalu via PR.
- JANGAN modifikasi docs/v2/* (frozen analysis).
- JANGAN tulis nilai literal ${GITHUB_PAT} atau ${VPS_PASSWORD} di code/commit/message — selalu pakai env var reference.
- Tailwind primary color: teal #04C99E

PRODUCTION INFO:
- Live URL: http://103.74.5.44/vipos/
- Backend: port 3001, JWT_SECRET dari env, default user admin/admin123
- VPS access: sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no root@103.74.5.44 "<cmd>"
- Deploy path: /var/www/vipos
- pm2 service: vipos-backend

ESCALATION:
- Stuck > 4 jam Devin: message user untuk bahas pemecahan task.
- Acceptance criteria tidak bisa terpenuhi karena dependency tersembunyi: message user dengan opsi (skip task, pecah task, eksekusi alternative).
- Conflict resolution complex: message user untuk approve strategy.
- Hardware required (P3+ tasks dengan BT printer, EDC, dll) yang tidak ada di environment Devin: message user untuk skip hardware integration testing atau provide hardware bridge.

START SEKARANG dari LANGKAH 0.
```

## Catatan untuk user

### Kapan prompt ini cukup?

Prompt universal cocok untuk **mayoritas task** (75-80% dari 86 tasks). Devin akan auto-pilih task next, eksekusi, dan PR.

### Kapan prompt ini KURANG cukup?

Untuk task yang butuh **input spesifik** dari Anda (yang tidak bisa di-auto-detect):

- **P0-02 (CI/CD)**: butuh konfirmasi Anda mau pakai GitHub Actions vs alternatif (Jenkins/CircleCI). Default = GitHub Actions; ikuti spec.
- **P3-12 (EDC integration)**: butuh hardware fisik EDC bank → Devin akan message Anda kalau tidak bisa test, mungkin minta bridge atau skip testing.
- **P5-\* (specialized apps)**: butuh keputusan apakah deploy KDS/Self Order sebagai APK terpisah atau modul di main app. Default = APK terpisah; ikuti spec.
- **P6-\* (GTM)**: butuh content writing yang opinion-heavy (positioning, tagline). Devin akan generate draft, minta Anda approve.

Untuk task spesial ini, Devin akan pause + message Anda dengan opsi konkret. Anda tinggal pilih.

### Bagaimana cara handoff Devin 01 → Devin 02?

Anda **tidak perlu intervensi**:

1. Devin 01 selesai task → buat PR.
2. Anda review + merge PR (atau kasih akses Devin auto-merge kalau Anda nyaman).
3. Buka session Devin baru → paste prompt universal di atas → Devin 02 auto-detect bahwa Devin 01 selesai (lihat phase doc + merged PR), pilih task berikutnya, lanjut.

### Pace yang masuk akal

- Mulai dengan 1 Devin sequential (Devin 01 P0-01 → merge → Devin 02 P0-02 → merge → ...).
- Setelah Phase 0 done, banyak task Phase 1+ bisa **paralel**: spawn 2-3 Devin sekaligus untuk task berbeda yang dependency sudah done.
- Setelah Phase 3 MVP done (~6 bulan), bisa paralel sampai 5-10 Devin (Phase 4 + 5 banyak task independen).

### Monitoring progress

Real-time:

- Branch commit: `https://github.com/alviarts/VIPOS/commits/main` (lihat squash merged commit per task)
- Per-branch live progress: `https://github.com/alviarts/VIPOS/tree/devin/{{task-ID}}-{{slug}}` (lihat WIP commit)
- PR list: `https://github.com/alviarts/VIPOS/pulls`
- Phase progress: scan `[pending]` vs `[done]` di `docs/v3/workflow/phase_*.md`

Aggregate:

- `grep -c '\[done\]' docs/v3/workflow/phase_*.md` — count selesai per phase
- `grep -c '\[pending\]' docs/v3/workflow/phase_*.md` — count pending per phase
