# Prompt untuk Devin session berikutnya — Lanjut development VIPOS

Copy-paste prompt di bawah ke session Devin baru.

---

```
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

State saat ini (per session 2026-05-03):
- Live deploy: http://103.74.5.44/vipos/  (login admin / admin123)
- Branch aktif: `devin/1777793568-initial-vipos-app` (PR #1 https://github.com/alviarts/VIPOS/pull/1, MASIH OPEN, belum di-merge ke main)
- VPS: 103.74.5.44, app di /var/www/vipos/, backend pm2 service `vipos-backend` di port 3001, nginx serve /vipos/ + proxy /vipos/api/ ke 3001
- Secrets sudah tersimpan permanen scope user: GITHUB_PAT, VPS_HOST=103.74.5.44, VPS_USER=root, VPS_PASSWORD, plus SSH key di ~/.ssh/devin_vps_ed25519 (host alias `vps` di ~/.ssh/config) → SSH key-based langsung working
- DB SQLite: /var/www/vipos/backend/data/vipos.db (better-sqlite3, schema migrations idempotent)

Yang sudah selesai di PR #1 (5 commit):
1. Analisa Majoo API (MAJOO_API_ANALYSIS.md) + 533 endpoint paths + 293 menu items
2. Deploy /vipos/ subpath (Vite base, React Router basename, axios baseURL, nginx)
3. Backend resources: departments, customers (kode auto PLG####), finance (cash_accounts + cash_transactions dengan saldo computed), inventory (movements dengan transactional stock update)
4. Frontend halaman baru: ProductsPage (5-tab wizard), CategoriesPage, CustomersPage, InventoryPage, FinancePage
5. 6 reusable UI components di frontend/src/components/ui/
6. Smoke-test 6/6 passed di production (lihat comment PR #1)

PRIORITAS BERIKUTNYA (pilih sesuai instruksi user):
A. Implement tab Varian / Resep / majoo Order di Produk wizard (saat ini gated locked)
B. Edit / Delete CRUD untuk Pelanggan dan Cash Account (saat ini hanya POST yang ditest)
C. Implement halaman lain dari Section 19 MAJOO_ANALYSIS.md (Karyawan, Promosi, Marketing, Invoice, dll)
D. Tambahkan dashboard analytics yang lebih kaya (chart, top products, dll mirroring Majoo dashboard)
E. Implementasi password change endpoint + ganti default admin/admin123 di production
F. Setup HTTPS Let's Encrypt jika VPS sudah punya domain

Workflow:
1. Pull latest: cd /home/ubuntu/repos/VIPOS && git fetch && git checkout devin/1777793568-initial-vipos-app && git pull
2. Test lokal: backend `cd backend && npm install && npm run seed && PORT=3001 JWT_SECRET=devtest npm start`, frontend `cd frontend && npm install && npm run dev`
3. Push ke branch yang sama (atau buat branch baru jika fitur substansial)
4. Deploy ke VPS: ssh -F ~/.ssh/config vps  →  cd /var/www/vipos && git pull && (cd backend && npm install --omit=dev) && (cd frontend && npm install && npm run build) && rsync -a --delete frontend/dist/ /var/www/vipos/frontend/dist/ && pm2 restart vipos-backend
5. Verify external: curl http://103.74.5.44/vipos/api/health

Catatan penting:
- VIPOS fully standalone — TIDAK proxy ke Majoo. Hanya pinjam pola UI/struktur API.
- Token JWT Majoo akun test sudah expired ~1 hari. Kalau perlu re-analisa Majoo, minta user export localStorage baru. JANGAN commit token ke repo.
- Push pakai: git push "https://x-access-token:${GITHUB_PAT}@github.com/alviarts/VIPOS.git" <branch>  (devin proxy 403 untuk repo ini, fallback ke direct PAT works)
- PR description / comment update via GitHub API direct karena tool git_pr punya scope issue: curl -X PATCH dengan -H "Authorization: Bearer ${GITHUB_PAT}"
- Tailwind primary color = teal #04C99E (Majoo branding)
- Pre-commit hooks: tidak ada di repo ini
```

---

## Background context lain

- File `MAJOO_ANALYSIS.md` (790 baris) berisi detail UI/UX Majoo per halaman — gunakan sebagai referensi pola UI ketika implement fitur baru
- File `MAJOO_API_ANALYSIS.md` (682 baris) berisi semua endpoint Majoo + auth conventions + response shape — gunakan sebagai referensi struktur API
- File `docs/majoo_api_paths.txt` = 533 path constants (bisa cari endpoint specific)
- File `docs/majoo_menu_flat.tsv` = 293 menu items dengan permissions
- File `docs/testing/section19-smoke-test.mp4` = 50-detik recording 6 test E2E di production (Section 19 features)
- File `docs/testing/section19-smoke-test-report.md` = laporan test detail dengan hasil aktual per assertion
- File `docs/testing/section19-smoke-test-plan.md` = test plan dengan fail-signal per assertion
- File `docs/testing/section19-smoke-test-annotations.json` = anotasi video (timestamp + assertion text)

## Quick test commands (verifikasi state)

```bash
# Login
TOKEN=$(curl -s -X POST http://103.74.5.44/vipos/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# Verify resources
curl -H "Authorization: Bearer $TOKEN" http://103.74.5.44/vipos/api/products | python3 -m json.tool | head -20
curl -H "Authorization: Bearer $TOKEN" http://103.74.5.44/vipos/api/categories | python3 -m json.tool
curl -H "Authorization: Bearer $TOKEN" http://103.74.5.44/vipos/api/customers | python3 -m json.tool
curl -H "Authorization: Bearer $TOKEN" http://103.74.5.44/vipos/api/finance/accounts | python3 -m json.tool
curl -H "Authorization: Bearer $TOKEN" http://103.74.5.44/vipos/api/inventory/summary | python3 -m json.tool
```
