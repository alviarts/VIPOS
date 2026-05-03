# VIPOS - Aplikasi POS/Kasir Modern

Aplikasi Point of Sale (POS) / Kasir modern yang mobile-friendly, dirancang untuk kemudahan penggunaan di tablet dan smartphone.

## Fitur

- **Dashboard** — Ringkasan penjualan harian/bulanan, grafik, produk terlaris
- **Kasir (POS)** — Interface kasir dengan keranjang belanja, pencarian produk, filter kategori
- **Manajemen Produk** — CRUD produk dengan kategori, SKU, stok
- **Transaksi** — Riwayat transaksi lengkap, detail, void/pembatalan
- **Laporan** — Laporan penjualan harian/bulanan, metode pembayaran, produk terlaris
- **Multi Pembayaran** — Cash, Kartu, QRIS
- **Multi User** — Role admin & kasir
- **Mobile-First** — Responsive design untuk tablet & smartphone

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **Auth:** JWT

## Quick Start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Setup environment

```bash
cp .env.example backend/.env
```

### 3. Seed sample data

```bash
cd backend && npm run seed
```

### 4. Run development

```bash
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:3001

### 5. Default Login

- **Admin:** `admin` / `admin123`

## Production Build

```bash
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/auth/register | Register (admin) |
| GET | /api/products | List products |
| POST | /api/products | Create product (admin) |
| PUT | /api/products/:id | Update product (admin) |
| DELETE | /api/products/:id | Delete product (admin) |
| GET | /api/categories | List categories |
| POST | /api/categories | Create category (admin) |
| GET | /api/transactions | List transactions |
| POST | /api/transactions | Create transaction |
| POST | /api/transactions/:id/void | Void transaction |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/dashboard/chart | Sales chart data |
| GET | /api/dashboard/top-products | Top selling products |

## License

MIT
