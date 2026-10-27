# Halal Formosa 2.0.2: release announcement draft

Draft for review. Written from the git history between `v2.0.1` and `main` (42 commits), following [brand-guidelines.md](brand-guidelines.md). Version numbers are **not bumped yet**: `package.json`, Android and iOS still say 2.0.1.

## Release name

**The Check-in Update** (matches the 2.0.1 pattern of "Update 2.0.1 is here")

In-app announcement title: **Update 2.0.2 is here**

Alternative names if you want a different tone: *The Community Update*, *Small Fixes, Big Difference*.

## What is in it (user-facing)

| Area | Change | Source commit |
|---|---|---|
| New | Yearly survey card on Home. 14 short questions, one per session, with an option to answer the rest straight away. Earns XP: 2 per answer, 20 bonus for finishing. Opens from a `/survey` link. | e6443f5, 706189d, 32b49bb, 3408b8f |
| New | Brand partner pages now list the partner's stores, stockists and the products they provide. Product details link to them. | 677bb41 |
| Fix | Back button after a barcode scan no longer leaves a blank screen. | 3eac6d0 |
| Fix | Explore map carousel shows the places in view, with at most one out-of-view gold place. | cfb635d |
| Fix | Real users no longer get wrongly blocked from searching (Explore, Search, Store, Trip). | 64b6a51 |
| Fix | Chinese ingredient keywords are now highlighted correctly in ingredient lists. | e5e1597 |
| Fix | Bottom sheets on Android are no longer covered by the navigation buttons. | 60fa9af |
| Fix | Signing out now signs out of this device only, not every device. | c194395 |
| Fix | Reels preview limit no longer loops. | 18126f1 |

Left out on purpose (internal, no visible change): secret-key migration of edge functions, `award-points-v2`, activity logging, admin pages, house-ad impression logging, product thumbnail storage.

## Check before publishing

- **Survey:** the frontend only reaches users with this release. The wording of the 14 questions can still be changed in the database without a release.
- **Thumbnails (194cc41, 086e660):** product thumbnails are now served from storage instead of paid image transforms. I did not claim "faster images" because I haven't measured it. Add a line if you want one.
- **Points:** `award-points-v2` replaced the points call. If the XP amounts users see changed, say so in the notes.
- Per the brand guidelines, no prices, tier limits or "24/7" claims are used.

---

## App Store: What's New (English, limit 4,000 characters)

```
The Check-in Update

NEW
• Yearly survey on Home. Answer one short question per visit, or the rest in one go, and earn XP for every answer.
• Brand partner pages now show their stores, stockists and the products they provide.

FIXED
• The back button after a barcode scan no longer leaves a blank screen.
• The Explore map carousel now shows the places you can actually see.
• Searching no longer wrongly blocks real users.
• Chinese ingredients are highlighted correctly in ingredient lists.
• Signing out now only signs out the device you are using.
• Reels no longer get stuck when the preview limit is reached.

Thank you for helping our community. Found a problem? Tell us on Instagram @halalformosa.
```

## App Store: What's New (Traditional Chinese)

```
簽到更新

新功能
• 首頁新增年度問卷。每次只需回答一個簡短問題，也可以一次答完其餘問題，每個答案都能獲得 XP。
• 品牌合作夥伴頁面現在會顯示其門市、經銷點與供應的產品。

修正
• 掃描條碼後按返回鍵不再出現空白畫面。
• 探索地圖的輪播現在顯示您實際看得到的地點。
• 搜尋時不再誤擋真實使用者。
• 成分表中的中文成分現在能正確標示。
• 登出現在只會登出目前使用的裝置。
• 達到預覽上限後，短影片不再卡住。

感謝您一同幫助我們的社群。遇到問題嗎？歡迎到 Instagram @halalformosa 告訴我們。
```

## App Store: What's New (Indonesian)

```
Pembaruan Check-in

BARU
• Survei tahunan di Beranda. Jawab satu pertanyaan singkat setiap kunjungan, atau sisanya sekaligus, dan dapatkan XP untuk setiap jawaban.
• Halaman mitra merek kini menampilkan toko, penyalur, dan produk yang mereka sediakan.

DIPERBAIKI
• Tombol kembali setelah memindai barcode tidak lagi menyisakan layar kosong.
• Karusel peta Jelajah kini menampilkan tempat yang benar-benar terlihat.
• Pencarian tidak lagi salah memblokir pengguna asli.
• Bahan dalam bahasa Mandarin kini ditandai dengan benar di daftar bahan.
• Keluar akun kini hanya keluar dari perangkat yang sedang dipakai.
• Reels tidak lagi macet saat batas pratinjau tercapai.

Terima kasih sudah membantu komunitas kita. Menemukan masalah? Beri tahu kami di Instagram @halalformosa.
```

---

## Google Play: What's new (limit 500 characters per language)

### English (en-US)

```
The Check-in Update
NEW: Yearly survey on Home. One short question per visit, earn XP for every answer. Brand partner pages now show their stores, stockists and products.
FIXED: Blank screen after barcode scan back button. Explore map carousel shows visible places. Real users no longer blocked from search. Chinese ingredients highlighted correctly. Android bottom sheets no longer hidden by navigation buttons. Sign out only on this device.
```

### Traditional Chinese (zh-TW)

```
簽到更新
新功能：首頁新增年度問卷，每次回答一個簡短問題，每個答案都能獲得 XP。品牌合作夥伴頁面現在會顯示其門市、經銷點與產品。
修正：掃描條碼後按返回鍵不再出現空白畫面。探索地圖輪播顯示可見的地點。搜尋不再誤擋真實使用者。成分表中的中文成分能正確標示。Android 底部面板不再被導覽按鈕遮住。登出只會登出目前的裝置。
```

### Indonesian (id)

```
Pembaruan Check-in
BARU: Survei tahunan di Beranda. Satu pertanyaan singkat per kunjungan, dapatkan XP untuk setiap jawaban. Halaman mitra merek kini menampilkan toko, penyalur, dan produk.
DIPERBAIKI: Layar kosong setelah tombol kembali di pemindaian barcode. Karusel peta Jelajah menampilkan tempat yang terlihat. Pengguna asli tidak lagi diblokir saat mencari. Bahan Mandarin ditandai dengan benar. Panel bawah Android tidak tertutup tombol navigasi. Keluar akun hanya di perangkat ini.
```

---

## In-app announcement and push (short)

**Title:** Update 2.0.2 is here

**Body:** A yearly survey on Home where every answer earns XP, richer brand partner pages, and a round of fixes for scanning, Explore and sign-out.

**Push (one line):** Halal Formosa 2.0.2 is out: yearly survey with XP, richer partner pages and fixes. Update now.

## Social caption (Instagram / Facebook)

```
Halal Formosa 2.0.2, the Check-in Update, is live.

✔ A short yearly survey on Home. Every answer earns XP.
✔ Brand partner pages now show stores, stockists and products.
✔ Fixes for barcode scan, the Explore map, search and sign-out.

Update on the App Store and Google Play. Thank you for building this with us.
```

## Release checklist (not done)

1. Bump to 2.0.2 with `npm version 2.0.2` (syncs Android versionCode/versionName and the three iOS targets).
2. Update `CHANGELOG.md` with a 2.0.2 section (the notes above are the user-facing part).
3. Build and submit to both stores, then tag `v2.0.2`.
4. After the stores serve 2.0.2: switch on the in-app announcement and schedule the push.
