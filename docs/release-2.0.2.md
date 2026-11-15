# Halal Formosa 2.0.2: release announcement draft

Draft for review. The store, push and social texts are deliberately short and public-safe; the table below is internal. Written from the git history between `v2.0.1` and `main` (42 commits), following [brand-guidelines.md](brand-guidelines.md). Version numbers are **not bumped yet**: `package.json`, Android and iOS still say 2.0.1.

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

## App Store: What's New (limit 4,000 characters)

Public wording: short, benefits only. No details about security, bot checks or backend work.

### English
```
The Check-in Update

• New yearly survey on Home. Answer a quick question and earn XP.
• Partner pages now show their stores and products.
• Smoother scanning, Explore and search, plus other fixes and improvements.

Thank you for helping our community.
```

### Traditional Chinese
```
簽到更新

• 首頁新增年度問卷，回答簡短問題即可獲得 XP。
• 合作夥伴頁面現在會顯示其門市與產品。
• 掃描、探索與搜尋更順暢，並包含其他修正與改進。

感謝您一同幫助我們的社群。
```

### Indonesian
```
Pembaruan Check-in

• Survei tahunan baru di Beranda. Jawab pertanyaan singkat dan dapatkan XP.
• Halaman mitra kini menampilkan toko dan produk mereka.
• Pemindaian, Jelajah, dan pencarian lebih lancar, plus perbaikan dan peningkatan lainnya.

Terima kasih sudah membantu komunitas kita.
```

---

## Google Play: What's new (limit 500 characters per language)

### English (en-US)
```
The Check-in Update
• New yearly survey on Home. Answer a quick question and earn XP.
• Partner pages now show their stores and products.
• Smoother scanning, Explore and search, plus other fixes and improvements.
```

### Traditional Chinese (zh-TW)
```
簽到更新
• 首頁新增年度問卷，回答簡短問題即可獲得 XP。
• 合作夥伴頁面現在會顯示其門市與產品。
• 掃描、探索與搜尋更順暢，並包含其他修正與改進。
```

### Indonesian (id)
```
Pembaruan Check-in
• Survei tahunan baru di Beranda. Jawab pertanyaan singkat dan dapatkan XP.
• Halaman mitra kini menampilkan toko dan produk mereka.
• Pemindaian, Jelajah, dan pencarian lebih lancar, plus perbaikan dan peningkatan lainnya.
```

---

## In-app announcement and push (short)

**Title:** Update 2.0.2 is here

**Body:** A yearly survey on Home where every answer earns XP, richer partner pages, and smoother scanning and search.

**Push (one line):** Halal Formosa 2.0.2 is out: a yearly survey with XP, richer partner pages and smoother scanning. Update now.

## Social caption (Instagram / Facebook)

```
Halal Formosa 2.0.2, the Check-in Update, is live.

✔ A short yearly survey on Home. Every answer earns XP.
✔ Partner pages now show their stores and products.
✔ Smoother scanning, Explore and search.

Update on the App Store and Google Play. Thank you for building this with us.
```

## Release checklist (not done)

1. Bump to 2.0.2 with `npm version 2.0.2` (syncs Android versionCode/versionName and the three iOS targets).
2. Update `CHANGELOG.md` with a 2.0.2 section (the notes above are the user-facing part).
3. Build and submit to both stores, then tag `v2.0.2`.
4. After the stores serve 2.0.2: switch on the in-app announcement and schedule the push.
