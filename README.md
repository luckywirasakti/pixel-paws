# 🐾 PixelPaws

Game web retro buat pelihara hewan virtual (kucing 🐱 / anjing 🐶 / kelinci 🐰).
Bergaya pixel-art 16-bit, berjalan **real-time** (hewan tetap "hidup" walau tab
ditutup), dan disimpan otomatis di browser — **tanpa backend/database**.

## ✨ Fitur

- **Pilih & adopsi** 1 dari 3 hewan, kasih nama sendiri.
- **5 kebutuhan** yang turun seiring waktu nyata: Kenyang, Energi, Senang,
  Bersih, Sehat.
- **Aksi:** kasih makan, ajak main (dapat koin), mandiin, tidur.
- **Ekonomi koin** sederhana — makan butuh koin, main menghasilkan koin.
- **Evolusi 3 tahap:** Bayi → Remaja (1 hari) → Dewasa (3 hari).
- **Kepribadian dinamis:** rawat baik → **Ceria ☀️**, terlantar → **Murung 🌧️**.
  Memengaruhi warna & ekspresi sprite-nya.
- Mercy mode: hewan **tidak pernah mati**, cuma sakit & bisa pulih.

## 🚀 Jalankan lokal

```bash
npm install
npm run dev      # buka http://localhost:3000
```

## ☁️ Deploy ke Vercel

Paling gampang, lewat web:

1. Push folder ini ke sebuah repo GitHub.
2. Buka [vercel.com/new](https://vercel.com/new), import repo-nya.
3. Vercel auto-deteksi Next.js — langsung **Deploy**. Selesai. ✅

Atau lewat CLI:

```bash
npm i -g vercel
vercel          # ikuti prompt
vercel --prod   # deploy production
```

Tidak perlu konfigurasi env var apa pun — semua state ada di `localStorage`.

## 🧱 Struktur

| File | Isi |
|------|-----|
| `app/page.tsx` | UI game + game loop (tick tiap detik) |
| `lib/game.ts` | State, decay real-time, evolusi, save/load |
| `lib/sprites.ts` | Sprite pixel-art 16×16 + renderer canvas |
| `app/globals.css` | Tema retro (font Press Start 2P) |

## 🔮 Ide pengembangan selanjutnya

- Mini-game beneran (tebak-tebakan / tangkap bola) buat farming koin.
- Toko & inventory: beli makanan/mainan/dekorasi kandang.
- Lebih banyak hewan + bentuk evolusi rahasia.
- Cloud save (Supabase/Vercel KV) biar lintas perangkat.
- Notifikasi "hewanmu lapar" lewat Web Push.
