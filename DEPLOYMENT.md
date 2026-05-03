# VIPOS Deployment — VPS (Ubuntu)

Dokumentasi deployment VIPOS ke VPS publik dengan Node.js + nginx + PM2.

## 1. Stack & Versi

| Komponen | Versi (target)          |
| -------- | ----------------------- |
| OS       | Ubuntu 22.04 LTS        |
| Node.js  | v20.x (atau lebih baru) |
| npm      | v10.x                   |
| nginx    | 1.18+                   |
| PM2      | 6.x                     |

## 2. Arsitektur Production

VIPOS di-deploy di **path prefix `/vipos`** supaya domain root tetap bebas untuk app lain.

```
                       Public Internet (http://<vps>/)
                              │
                              ▼
                         ┌──────────┐
                         │  nginx    │  :80 (default_server)
                         └─┬─────┬─┬─┘
                /          │     │  │  /vipos/api/*
          (welcome page)   │     │  │
          /var/www/html    │     │  ▼
                           │     │  ┌──────────────┐
                           │     │  │ pm2: vipos-  │ :3001
                           │     │  │  backend     │
              /vipos/      │     │  │ (Express)    │
         (SPA static)      ▼     │  └────┬────────┘
         /var/www/vipos/         │       ▼
         apps/web/dist/          │  /var/www/vipos/apps/backend/
                                 │  data/vipos.db (SQLite)
                                 ▼
                              (rewrites
                              /vipos/api/x → /api/x
                              before proxy_pass)
```

- `nginx` (default_server, port 80) memiliki tiga route:
  - `/` → welcome page di `/var/www/html`
  - `/vipos/` → SPA static dari `/var/www/vipos/apps/web/dist/` (try_files → SPA fallback)
  - `/vipos/api/` → reverse proxy ke `http://127.0.0.1:3001/api/` (backend tidak tahu prefix /vipos)
  - `/vipos` → 301 redirect ke `/vipos/`
- `pm2` me-supervise proses backend (auto-restart, log rotation, startup on reboot).
- `SQLite` file-based — tidak perlu DB server terpisah.

### 2.1 Frontend path-prefix configuration

Frontend di-build dengan `base: '/vipos/'` di `apps/web/vite.config.js` supaya semua asset URL di-prefix `/vipos/`. Komponen yang menggunakan path:

| Pakai                    | Mode dev (`/`) | Mode prod (`/vipos/`)                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Vite asset paths         | `/assets/*.js` | `/vipos/assets/*.js`                            |
| `BrowserRouter basename` | `/`            | `/vipos/` (auto via `import.meta.env.BASE_URL`) |
| Axios baseURL            | `/api`         | `/vipos/api`                                    |
| Favicon                  | `/vite.svg`    | `/vipos/vite.svg` (via `%BASE_URL%`)            |

Dev mode (`npm run dev`) tetap di `localhost:5173/` (tanpa prefix) supaya nyaman.

## 3. Quick Deploy (One-Shot Script)

Jalankan di VPS sebagai `root`:

```bash
# 1. Clone repo
mkdir -p /var/www
cd /var/www
git clone -b main https://github.com/alviarts/VIPOS.git vipos
# (atau ganti -b ke branch yang ingin di-deploy)

# 2. Install deps (npm workspaces — install root sekaligus install semua apps)
cd /var/www/vipos
npm install

# 3. Setup env
cp .env.example apps/backend/.env
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" apps/backend/.env
sed -i "s|NODE_ENV=.*|NODE_ENV=production|" apps/backend/.env

# 4. Seed database (admin user + sample produk/kategori)
npm run seed

# 5. Build frontend
npm run build:web

# 6. Configure nginx (VIPOS at /vipos, welcome page at /)
cat > /etc/nginx/sites-available/vipos << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Default site: welcome page
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;

    client_max_body_size 16M;

    # VIPOS SPA static
    location /vipos/ {
        alias /var/www/vipos/apps/web/dist/;
        try_files $uri $uri/ /vipos/index.html;
    }

    # VIPOS asset cache
    location /vipos/assets/ {
        alias /var/www/vipos/apps/web/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # VIPOS API → backend (rewrites /vipos/api/x → /api/x)
    location /vipos/api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_buffering off;
        proxy_read_timeout 60s;
    }

    # Bare /vipos → redirect to /vipos/
    location = /vipos {
        return 301 /vipos/;
    }

    # Default catch-all (welcome page only — no SPA fallback)
    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/vipos /etc/nginx/sites-enabled/vipos
nginx -t && systemctl reload nginx

# 7. Start backend with pm2
pm2 start /var/www/vipos/apps/backend/src/index.js \
    --name vipos-backend \
    --cwd /var/www/vipos/apps/backend \
    --time
pm2 save

# 8. Setup pm2 to auto-start on reboot
pm2 startup systemd -u root --hp /root
# (jalankan command yang di-output oleh `pm2 startup`)
```

## 4. Update / Redeploy

Dua cara: **otomatis via GitHub Actions** (default sejak P0-02) atau **manual** (jalankan helper script).

### 4.1 Otomatis (CI/CD)

Setiap push/merge ke `main` akan trigger workflow `.github/workflows/deploy-vps.yml` yang SSH ke VPS dan jalankan `tools/scripts/deploy.sh`. Tidak perlu intervensi manual.

Monitor di https://github.com/alviarts/VIPOS/actions/workflows/deploy-vps.yml. Workflow juga bisa di-trigger manual via tombol "Run workflow" di GitHub UI (`workflow_dispatch`).

### 4.2 Manual (gunakan helper script)

```bash
# Di VPS (sebagai root)
cd /var/www/vipos && bash tools/scripts/deploy.sh
```

Script akan:

1. `git fetch + checkout main + reset --hard` ke `origin/main`
2. `npm install` untuk semua workspaces
3. `npm run build:web` (output di `apps/web/dist/`)
4a. Migrasi legacy `backend/.env` → `apps/backend/.env` kalau ada (preserve JWT_SECRET supaya session user tidak invalid)
4b. Bootstrap `apps/backend/.env` baru kalau belum ada legacy + belum ada new (auto-generate JWT_SECRET)
4c-d. Stop pm2 dulu, lalu migrasi legacy SQLite (`backend/data/vipos.db` + WAL/SHM) → `apps/backend/data/`
5. Re-create pm2 process kalau cwd masih ke layout lama; kalau sudah benar tinggal `pm2 restart`
6. Patch path `/frontend/dist` → `/apps/web/dist` di nginx config + `nginx -t && systemctl reload nginx`

Idempotent — aman re-run.

### 4.3 Manual lite (tanpa script)

```bash
cd /var/www/vipos
git pull
npm install        # install deps baru kalau ada (workspaces aware)
npm run build:web  # output: apps/web/dist/
pm2 restart vipos-backend
# nginx reload tidak perlu — frontend dist akan langsung dibaca
```

### 4.4 GitHub Actions setup (one-time, sudah dilakukan di P0-02)

Workflow deploy butuh empat repo secret yang sudah di-set lewat GitHub UI atau API:

| Secret | Nilai | Kegunaan |
|---|---|---|
| `VPS_HOST` | `103.74.5.44` | Target SSH |
| `VPS_USER` | `root` | User SSH |
| `VPS_DEPLOY_PATH` | `/var/www/vipos` | Working dir di VPS |
| `VPS_SSH_KEY` | Private key (ed25519) untuk akses root@103.74.5.44 | SSH auth tanpa password |

Key-pair di-generate di session Devin P0-02 dengan `ssh-keygen -t ed25519 -f ~/.ssh/vipos_deploy -N ""`. Public key di-append ke `/root/.ssh/authorized_keys` di VPS via `sshpass`. Private key disimpan sebagai:
- GitHub repo secret `VPS_SSH_KEY` (untuk Actions runner)
- Devin org secret `VPS_SSH_KEY` (untuk Devin sessions ke depan supaya bisa SSH key-based ke VPS tanpa password prompt overhead)

Kalau key-pair butuh di-rotate (e.g. ada Devin session yang leak), regenerate + update kedua tempat penyimpanan.

### 4.5 Branch protection (manual setup, satu kali)

Branch protection di main perlu di-setup lewat GitHub UI (PAT user belum tentu punya permission `administration: write`):

1. Buka https://github.com/alviarts/VIPOS/settings/branches
2. Klik **Add classic branch protection rule** (atau **Add ruleset** di repo yang lebih baru)
3. Branch name pattern: `main`
4. Enable:
   - [x] **Require a pull request before merging** (Required approvals: 0 atau 1, sesuai preferensi)
   - [x] **Require status checks to pass before merging**
     - Required checks: `build (web + backend)`, `lint (--if-present)`, `test (--if-present)` (cari setelah CI workflow run pertama kali)
   - [x] **Require branches to be up to date before merging** (opsional)
   - [x] **Do not allow bypassing the above settings** (opsional, lock juga ke admin)
5. Save

Setelah aktif, semua perubahan ke `main` wajib lewat PR + CI hijau.

## 5. Logging & Monitoring

```bash
# Backend logs (live)
pm2 logs vipos-backend

# Last 100 lines
pm2 logs vipos-backend --lines 100 --nostream

# Status semua proses
pm2 list

# Detail spesifik
pm2 show vipos-backend

# Restart count, memory, CPU
pm2 monit

# Nginx access log
tail -f /var/log/nginx/access.log

# Nginx error log
tail -f /var/log/nginx/error.log
```

## 6. Konfigurasi Penting

### 6.1 Environment Variables (`apps/backend/.env`)

```ini
PORT=3001                             # Backend port (jangan ubah, sudah hardcoded di nginx)
JWT_SECRET=<generated-via-openssl>    # Wajib di-generate baru (jangan pakai default)
NODE_ENV=production
```

**JANGAN COMMIT `.env` ke repo.** Sudah di-ignore di `.gitignore`.

### 6.2 Database

- Path: `/var/www/vipos/apps/backend/data/vipos.db`
  (lihat `apps/backend/src/models/database.js` — path relatif ke `apps/backend/data/vipos.db`)
- Backup: `cp /var/www/vipos/apps/backend/data/vipos.db /var/www/vipos/apps/backend/data/vipos.db.bak`
- Legacy paths (pre-monorepo) yang di-migrate otomatis oleh `tools/scripts/deploy.sh` saat deploy pertama kali:
  - `/var/www/vipos/backend/data/vipos.db` (+ `vipos.db-wal`, `vipos.db-shm`) — layout post-PR #1
  - `/var/www/vipos/backend/database.db` — layout pre-PR #1

Untuk reset ke seed default:

```bash
rm /var/www/vipos/apps/backend/data/vipos.db
cd /var/www/vipos && npm run seed
pm2 restart vipos-backend
```

### 6.3 Default Admin Credentials

- **username:** `admin`
- **password:** `admin123`

**WAJIB:** ganti password admin setelah deploy production via UI Settings (TODO: implement password change endpoint).

## 7. Firewall

Sudah otomatis open via cloud provider; UFW di VPS ini status `inactive`. Kalau aktif, perlu:

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (kalau mau pakai Let's Encrypt)
```

## 8. HTTPS (Let's Encrypt) — Optional

Kalau punya domain, bisa pakai Let's Encrypt:

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Issue cert (replace example.com dengan domain Anda)
certbot --nginx -d vipos.example.com -d www.vipos.example.com

# Auto-renew sudah enabled via cron/timer dari paket certbot
systemctl status certbot.timer
```

Sebelum jalankan certbot, pastikan A record domain mengarah ke IP VPS.

## 9. Multiple Apps di Server yang Sama

VPS ini sudah punya proses lain (`finance-bot-tg`, `bot-wa`, `captcha-proxy` di port 8090). Konflik port:

| App                              | Port                | Status               |
| -------------------------------- | ------------------- | -------------------- |
| OpenSSH                          | 22                  | (managed by systemd) |
| Captcha proxy (nginx)            | 8090 (HTTPS)        | (separate vhost)     |
| **VIPOS nginx (default_server)** | **80**              | (this app)           |
| **VIPOS backend**                | **3001**            | (this app)           |
| finance-bot-tg                   | (no listening port) | (online)             |
| bot-wa                           | (no listening port) | (stopped)            |

Tidak ada konflik. VIPOS aman jalan di port 80.

## 10. Troubleshooting

### Backend tidak start

```bash
pm2 logs vipos-backend --err --lines 50
# cek apakah port 3001 sudah terpakai
ss -tnlp | grep 3001
```

### Frontend 404 di SPA route (refresh halaman /products dapat 404)

Pastikan `try_files $uri $uri/ /index.html;` ada di nginx config (sudah ada di config di atas).

### CORS errors di browser

Backend punya `app.use(cors())` (allow all origin). Kalau perlu restrict, edit `apps/backend/src/index.js`.

### Database locked / corrupt

```bash
pm2 stop vipos-backend
sqlite3 /var/www/vipos/apps/backend/data/vipos.db "PRAGMA integrity_check;"
pm2 start vipos-backend
```

### Lupa JWT secret (existing tokens jadi invalid setelah re-deploy)

JWT secret di `apps/backend/.env` PERSISTENT — kalau hilang, semua token user existing harus login ulang. Backup file `.env` (dengan aman) sebelum redeploy.

## 11. Deployment Status (3 Mei 2026)

- **VPS:** 103.74.5.44 (Ubuntu 22.04)
- **URL Public:** http://103.74.5.44/vipos/
- **Welcome page:** http://103.74.5.44/ (default nginx + link ke VIPOS)
- **Branch deployed:** `main` (auto-deploy via GitHub Actions sejak P0-02)
- **PM2 process:** `vipos-backend` (cwd: `/var/www/vipos/apps/backend`)
- **Layout:** monorepo (apps/web + apps/backend) per P0-01
- **Verified working (external):**
  - GET / → 200 (welcome page)
  - GET /vipos → 301 → /vipos/
  - GET /vipos/ → 200 (SPA shell, asset paths /vipos/...)
  - GET /vipos/dashboard → 200 (SPA fallback works on refresh)
  - GET /vipos/assets/index-\*.js → 200
  - POST /vipos/api/auth/login (admin/admin123) → 200, returns JWT
  - GET /vipos/api/categories (with Bearer token) → 200
  - GET /vipos/api/products (with Bearer token) → 200
