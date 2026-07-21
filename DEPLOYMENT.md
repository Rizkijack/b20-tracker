# 🚀 Deployment Guide — B20 Tracker

Panduan lengkap deploy B20 Tracker ke Vercel (gratis) dengan domain *.vercel.app.

---

## 📋 Prerequisites

Yang Anda butuhkan:
- ✅ **Akun GitHub** (gratis) — [github.com](https://github.com)
- ✅ **Akun Vercel** (gratis) — [vercel.com](https://vercel.com) (login pakai GitHub)
- ✅ **Git terinstall** di komputer

---

## 🔧 Step 1: Konfigurasi Git (sekali saja)

Set nama dan email Git Anda (ganti dengan data Anda):

```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

---

## 📦 Step 2: Upload Code ke GitHub

### Opsi A: Lewat GitHub Website (paling mudah)

1. Buka [github.com/new](https://github.com/new)
2. Repository name: `b20-tracker`
3. Description: `Real-time B20 token tracker for Base Mainnet`
4. Pilih **Public** (agar Vercel free bisa deploy)
5. **Jangan** centang "Add a README" (sudah ada)
6. Klik **Create repository**

Setelah repo dibuat, GitHub akan menampilkan URL repo. Salin URL itu, lalu jalankan:

```bash
cd C:/Users/USER/ZCodeProject/b20-tracker

# Ganti URL dengan URL repo Anda
git remote add origin https://github.com/USERNAME-ANDA/b20-tracker.git

# Rename branch ke main
git branch -M main

# Push code
git push -u origin main
```

Saat diminta, masukkan:
- **Username**: username GitHub Anda
- **Password**: [Personal Access Token](https://github.com/settings/tokens/new) (bukan password login!)

> 💡 **Cara buat Personal Access Token:**
> 1. Buka [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
> 2. Note: `B20 Tracker deploy`
> 3. Expiration: 90 days
> 4. Scope: centang `repo` (full control of private repositories)
> 5. Klik **Generate token** → salin token (hanya muncul sekali!)

---

## 🌐 Step 3: Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new)
2. Login pakai akun GitHub Anda
3. Klik **Import Git Repository**
4. Pilih repo `b20-tracker` Anda
5. **Konfigurasi** (sudah otomatis terisi dari `vercel.json`):
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: (default)
6. **Environment Variables**:
   - `NEXT_PUBLIC_BASE_RPC_URL` = `https://mainnet.base.org`
   - **Penting:** API keys (`BIRDEYE_API_KEY`, `COINMARKETCAP_API_KEY`, `COINGECKO_API_KEY`) **jangan di-paste di file komit**.
     Masukkan via Vercel Dashboard → Settings → Environment Variables. Variable ini bersifat server-only dan tidak pernah dikirim ke browser.
7. Klik **Deploy** 🎉

Tunggu 1-2 menit sampai build selesai. Website Anda akan live di:
```
https://b20-tracker-USERNAME.vercel.app
```

> 🔐 **API Keys & Environment Variables**
> Khusus di Vercel: setelah deploy pertama selesai, buka project dashboard → tab **Settings** → **Environment Variables**.
> Tambahkan variable ini untuk mengaktifkan market-data premium:
> - `BIRDEYE_API_KEY` → paste key dari [Birdeye Profile](https://birdeye.so/user/profile)
> - `COINMARKETCAP_API_KEY` → paste key dari [CMC Developer](https://pro.coinmarketcap.com/signup)
> - `COINGECKO_API_KEY` → (opsional) paste key dari [CoinGecko](https://www.coingecko.com/en/api/pricing)
> - `UPSTASH_REDIS_REST_URL` → (opsional) URL dari [Upstash Console](https://console.upstash.com/redis)
> - `UPSTASH_REDIS_REST_TOKEN` → (opsional) REST token dari Upstash Console
> - `REDIS_URL` / `UPSTASH_URL` → (legacy fallback) hanya URL saja (jarang dipakai)
>
> Jangan simpan keys di file yang dikomit (`.env.example`, `.env`). Vercel menyimpan ini secara encrypted.

---

## 🔄 Auto-Deploy

Setelah deploy pertama, setiap kali Anda `git push` ke branch `main`:
- Vercel akan **otomatis rebuild** dan deploy ulang
- Website akan update dalam 1-2 menit
- Anda dapat **preview URL** untuk testing sebelum production

---

## 🎨 Custom Domain (Opsional)

Vercel memberikan subdomain gratis (`*.vercel.app`). Untuk custom domain:

1. Buka dashboard Vercel → project `b20-tracker`
2. Tab **Settings** → **Domains**
3. Klik **Add Domain**
4. Masukkan domain Anda (e.g., `b20tracker.yourdomain.com`)
5. Ikuti instruksi DNS setup

> Domain gratis tersedia di: [Freenom](https://freenom.com), [is-a.dev](https://is-a.dev), [js.org](https://js.org)

---

## 🔍 Verifikasi Deployment

Setelah deploy, cek website Anda:
- ✅ Halaman dashboard muncul dengan dark theme
- ✅ Stats bar menampilkan "Block Height" (angka berubah)
- ✅ "LIVE" indicator menyala hijau di kanan atas
- ✅ Token list mulai terisi (mungkin butuh beberapa menit untuk scan)
- ✅ Live Event Feed menampilkan transaksi B20 real-time

---

## 🆘 Troubleshooting

### Build gagal di Vercel
```bash
# Test build lokal dulu
cd C:/Users/USER/ZCodeProject/b20-tracker
npm run build
```

### RPC error / rate limit
Edit `NEXT_PUBLIC_BASE_RPC_URL` di Vercel Settings → Environment Variables. Gunakan provider berbayar dengan free tier:
- **Alchemy**: [alchemy.com](https://alchemy.com) — 300M compute units gratis/bulan
- **QuickNode**: [quicknode.com](https://quicknode.com) — 10M API credits gratis/bulan
- **Infura**: [infura.io](https://infura.io) — 100K requests/hari gratis

### Token tidak muncul
- B20 Tracker scan block per block — butuh waktu untuk mencapai block awal B20
- Refresh halaman setelah 1-2 menit
- Cek console browser (F12) untuk error

### Push ke GitHub gagal
```bash
# Cek remote URL
git remote -v

# Hapus dan tambah ulang
git remote remove origin
git remote add origin https://github.com/USERNAME-ANDA/b20-tracker.git

# Force push (hati-hati!)
git push -u origin main --force
```

---

## 📞 Bantuan

- 📖 [Vercel Docs](https://vercel.com/docs)
- 📖 [Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
- 📖 [Git Handbook](https://guides.github.com/introduction/git-handbook/)
