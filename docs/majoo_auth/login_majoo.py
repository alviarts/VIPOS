"""
Script untuk login otomatis ke Majoo dashboard menggunakan localStorage data.
Jalankan dari root repo: python3 docs/majoo_auth/login_majoo.py

Prasyarat:
- Browser Chrome sudah jalan dengan CDP di http://localhost:29229
- pip install playwright (sudah terinstall di Devin)
"""

import asyncio
import json
import os

from playwright.async_api import async_playwright

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCALSTORAGE_FILE = os.path.join(SCRIPT_DIR, "localstorage.json")

PAGES_TO_VISIT = [
    ("Dashboard Penjualan", "https://dashboard.majoo.id/sales-dashboard"),
    ("Daftar Produk", "https://dashboard.majoo.id/item"),
    ("Daftar Kategori", "https://dashboard.majoo.id/item/category"),
    ("Laporan Penjualan", "https://dashboard.majoo.id/report/sales-summary"),
    ("Pelanggan", "https://dashboard.majoo.id/customer"),
    ("Pengaturan", "https://dashboard.majoo.id/message/inbox"),
]


async def main():
    # Load localStorage data
    with open(LOCALSTORAGE_FILE, "r") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} localStorage items")

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:29229")
        context = browser.contexts[0]
        page = context.pages[0]

        # Navigate to Majoo domain first
        print("Navigating to dashboard.majoo.id...")
        try:
            await page.goto(
                "https://dashboard.majoo.id/auth/login",
                wait_until="domcontentloaded",
                timeout=15000,
            )
        except Exception:
            pass
        await asyncio.sleep(3)

        # Set all localStorage items
        print("Setting localStorage items...")
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            try:
                await page.evaluate(
                    "(args) => { localStorage.setItem(args.key, args.value); }",
                    {"key": key, "value": str(value)},
                )
            except Exception as e:
                print(f"  Warning: could not set {key}: {e}")

        print(f"Set {len(data)} localStorage items")

        # Navigate to dashboard
        print("\nNavigating to sales dashboard...")
        try:
            await page.goto(
                "https://dashboard.majoo.id/sales-dashboard",
                wait_until="domcontentloaded",
                timeout=20000,
            )
        except Exception:
            pass
        await asyncio.sleep(5)

        current_url = page.url
        title = await page.title()
        print(f"Current URL: {current_url}")
        print(f"Page title: {title}")

        if "login" not in current_url.lower():
            print("\n=== LOGIN BERHASIL! ===")
            print("Dashboard Majoo sudah terbuka. Silakan lanjutkan analisis.")
        else:
            print("\n=== TOKEN EXPIRED ===")
            print("Token sudah kadaluarsa. Minta user untuk export localStorage baru.")
            print("Instruksi:")
            print("1. User buka https://dashboard.majoo.id (sudah login)")
            print("2. F12 -> Console -> copy(JSON.stringify(localStorage))")
            print("3. Paste ke file dan kirim ke Devin")
            return

        # Optionally visit all pages
        print("\n--- Halaman yang bisa dikunjungi ---")
        for name, url in PAGES_TO_VISIT:
            print(f"  {name}: {url}")


if __name__ == "__main__":
    asyncio.run(main())
