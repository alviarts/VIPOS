# Majoo Auth Data — Untuk Devin Berikutnya

## Cara Login ke Dashboard Majoo

Majoo menggunakan **localStorage** (JWT token) untuk autentikasi, bukan hanya cookies.
Cloudflare Turnstile captcha memblokir browser otomatis, jadi login manual tidak bisa dilakukan.

### Langkah Auto-Login:

1. Jalankan script `login_majoo.py` di bawah ini:
```bash
python3 docs/majoo_auth/login_majoo.py
```

2. Script akan:
   - Import localStorage data ke browser (via Playwright CDP)
   - Navigate ke dashboard Majoo
   - Jika token masih valid, langsung masuk dashboard

### Jika Token Expired:
- Token JWT Majoo berlaku ~24 jam
- Minta user untuk export ulang localStorage:
  1. User buka https://dashboard.majoo.id (sudah login)
  2. Tekan F12 → Console
  3. Jalankan: `copy(JSON.stringify(localStorage))`
  4. Paste hasilnya ke file dan kirim

### Files:
- `localstorage.json` — Full localStorage export dari browser user (berisi JWT token, user data)
- `cookies.txt` — Cookies Majoo (format Netscape, opsional)
- `login_majoo.py` — Script auto-login via Playwright CDP

### Info User Majoo:
- Email: vielz883013@proton.me
- User ID: 2536270
- Branch ID: 742446
- Username: ads
- Account Type: TRIAL
