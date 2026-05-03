# VIPOS Deployment — VPS (Ubuntu)

Dokumentasi deployment VIPOS ke VPS publik dengan Node.js + nginx + PM2.

## 1. Stack & Versi

| Komponen | Versi (target) |
|---|---|
| OS | Ubuntu 22.04 LTS |
| Node.js | v20.x (atau lebih baru) |
| npm | v10.x |
| nginx | 1.18+ |
| PM2 | 6.x |

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
         frontend/dist/          │  /var/www/vipos/backend/
                                 │  database.sqlite (SQLite)
                                 ▼
                              (rewrites
                              /vipos/api/x → /api/x
                              before proxy_pass)
```

- `nginx` (default_server, port 80) memiliki tiga route:
  - `/` → welcome page di `/var/www/html`
  - `/vipos/` → SPA static dari `/var/www/vipos/frontend/dist/` (try_files → SPA fallback)
  - `/vipos/api/` → reverse proxy ke `http://127.0.0.1:3001/api/` (backend tidak tahu prefix /vipos)
  - `/vipos` → 301 redirect ke `/vipos/`
- `pm2` me-supervise proses backend (auto-restart, log rotation, startup on reboot).
- `SQLite` file-based — tidak perlu DB server terpisah.

### 2.1 Frontend path-prefix configuration

Frontend di-build dengan `base: '/vipos/'` di `vite.config.js` supaya semua asset URL di-prefix `/vipos/`. Komponen yang menggunakan path:

| Pakai | Mode dev (`/`) | Mode prod (`/vipos/`) |
|---|---|---|
| Vite asset paths | `/assets/*.js` | `/vipos/assets/*.js` |
| `BrowserRouter basename` | `/` | `/vipos/` (auto via `import.meta.env.BASE_URL`) |
| Axios baseURL | `/api` | `/vipos/api` |
| Favicon | `/vite.svg` | `/vipos/vite.svg` (via `%BASE_URL%`) |

Dev mode (`npm run dev`) tetap di `localhost:5173/` (tanpa prefix) supaya nyaman.


## 3. Quick Deploy (One-Shot Script)

Jalankan di VPS sebagai `root`:

```bash
# 1. Clone repo
mkdir -p /var/www
cd /var/www
git clone -b main https://github.com/alviarts/VIPOS.git vipos
# (atau ganti -b ke branch yang ingin di-deploy)

# 2. Install deps
cd /var/www/vipos
npm run install:all

# 3. Setup env
cp .env.example backend/.env
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" backend/.env
sed -i "s|NODE_ENV=.*|NODE_ENV=production|" backend/.env

# 4. Seed database (admin user + sample produk/kategori)
cd backend && npm run seed && cd ..

# 5. Build frontend
cd frontend && npm run build && cd ..

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
        alias /var/www/vipos/frontend/dist/;
        try_files $uri $uri/ /vipos/index.html;
    }

    # VIPOS asset cache
    location /vipos/assets/ {
        alias /var/www/vipos/frontend/dist/assets/;
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
pm2 start /var/www/vipos/backend/src/index.js \
    --name vipos-backend \
    --cwd /var/www/vipos/backend \
    --time
pm2 save

# 8. Setup pm2 to auto-start on reboot
pm2 startup systemd -u root --hp /root
# (jalankan command yang di-output oleh `pm2 startup`)
```

## 4. Update / Redeploy

```bash
cd /var/www/vipos
git pull
npm run install:all  # install deps baru kalau ada
cd frontend && npm run build && cd ..
pm2 restart vipos-backend
# nginx reload tidak perlu — frontend dist akan langsung dibaca
```

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

### 6.1 Environment Variables (`backend/.env`)

```ini
PORT=3001                             # Backend port (jangan ubah, sudah hardcoded di nginx)
JWT_SECRET=<generated-via-openssl>    # Wajib di-generate baru (jangan pakai default)
NODE_ENV=production
```

**JANGAN COMMIT `.env` ke repo.** Sudah di-ignore di `.gitignore`.

### 6.2 Database

- Path: `/var/www/vipos/backend/database.db` (default better-sqlite3 location)
- Backup: `cp /var/www/vipos/backend/database.db /var/www/vipos/backend/database.db.bak`

Untuk reset ke seed default:
```bash
rm /var/www/vipos/backend/database.db
cd /var/www/vipos/backend && npm run seed
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

| App | Port | Status |
|---|---|---|
| OpenSSH | 22 | (managed by systemd) |
| Captcha proxy (nginx) | 8090 (HTTPS) | (separate vhost) |
| **VIPOS nginx (default_server)** | **80** | (this app) |
| **VIPOS backend** | **3001** | (this app) |
| finance-bot-tg | (no listening port) | (online) |
| bot-wa | (no listening port) | (stopped) |

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
Backend punya `app.use(cors())` (allow all origin). Kalau perlu restrict, edit `backend/src/index.js`.

### Database locked / corrupt
```bash
pm2 stop vipos-backend
sqlite3 /var/www/vipos/backend/database.db "PRAGMA integrity_check;"
pm2 start vipos-backend
```

### Lupa JWT secret (existing tokens jadi invalid setelah re-deploy)
JWT secret di `backend/.env` PERSISTENT — kalau hilang, semua token user existing harus login ulang. Backup file `.env` (dengan aman) sebelum redeploy.

## 11. Deployment Status (3 Mei 2026)

- **VPS:** 103.74.5.44 (Ubuntu 22.04)
- **URL Public:** http://103.74.5.44/vipos/
- **Welcome page:** http://103.74.5.44/ (default nginx + link ke VIPOS)
- **Branch deployed:** `devin/1777793568-initial-vipos-app` (akan di-merge ke `main` setelah review)
- **PM2 process:** `vipos-backend` (id=3, online)
- **Verified working (external):**
  - GET / → 200 (welcome page)
  - GET /vipos → 301 → /vipos/
  - GET /vipos/ → 200 (SPA shell, asset paths /vipos/...)
  - GET /vipos/dashboard → 200 (SPA fallback works on refresh)
  - GET /vipos/assets/index-*.js → 200
  - POST /vipos/api/auth/login (admin/admin123) → 200, returns JWT
  - GET /vipos/api/categories (with Bearer token) → 200
  - GET /vipos/api/products (with Bearer token) → 200
