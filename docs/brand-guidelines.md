# Halal Formosa — Brand Guidelines

For anyone making marketing material (carousels, videos, posts, emails). Everything here is taken from the app itself: `src/theme/variables.css`, `src/locales/en.json`, the logo in `public/logo-raw/logo.png`, and the profile screen's social links. Where a rule is a recommendation rather than something the app already does, it says so.

---

## 1. Who we are

**Halal Formosa** is a mobile app (iOS + Android) that helps Muslims living in or visiting Taiwan eat and live with confidence. "Formosa" is the historical name for Taiwan.

**What the app does**
- **Scan** a barcode or an ingredient list (OCR) and get a verdict: Halal, Muslim-friendly, Syubhah or Haram.
- **Explore** a map of verified restaurants, shops and mosques, with directions.
- **Pray**: prayer times by location, Qibla, mosques nearby.
- **Contribute and earn**: add products and places, complete daily missions, earn XP, climb the leaderboard, unlock achievements.
- **Learn**: Halal & Islam news, announcements, trips.
- **Support**: Halal Formosa Pro (subscription), partner businesses, store, Boba donations.

**Who it is for:** Muslim students (degree, exchange, language), workers and residents in Taiwan, and Muslim travellers visiting. Taiwanese-language packaging is the core problem we solve, so the app is built for people who can't read it.

**Languages:** English, Traditional Chinese, Simplified Chinese, Indonesian, Malay (+ Brunei Malay), Arabic, Urdu, Bengali, Hindi, Thai, Vietnamese, Filipino, Turkish, Japanese, Korean. Marketing in English, Traditional Chinese and Indonesian covers most of the audience.

**Positioning in one line (recommended):** *The fastest way to know what's halal in Taiwan.*

---

## 2. Brand personality and voice

Warm, practical, community-first. A helpful friend who has lived in Taiwan a while, not a certification authority.

| Is | Is not |
|---|---|
| Clear and direct | Preachy or lecturing |
| Friendly, light touch of humour (boba, mochi, Taroko) | Slangy or meme-heavy |
| Respectful of faith | Using religious language as a sales hook |
| Honest about uncertainty (Syubhah exists for a reason) | Overclaiming ("100% guaranteed halal") |
| Community voice: "we", "our community", "contributors" | Corporate voice |

**Writing rules**
- Short sentences. One idea per slide or line.
- Lead with the problem the viewer has ("Can't read the ingredients?"), then the app as the answer.
- Use real app wording for the labels below. Don't invent new status names.
- Emoji sparingly, and in the way the app does: 🎉 for celebration, ❤️ for support, ⭐ for Pro. Never on verdicts.
- Don't claim the app *certifies* anything. It reports status based on ingredients, the product registry and community verification.

**Example lines in the app's own style**
- "Scan Ingredients. Check Halal status instantly."
- "Scan Barcode. Check product instantly."
- "Help Muslims discover Halal Formosa to ease their life."
- "Thank you for supporting Halal Formosa ❤️"

---

## 3. Name and wording

- Write **Halal Formosa** (two words, both capitalised). Never "HalalFormosa" or "Halal formosa" in running text.
- Paid tier: **Halal Formosa Pro** (the app uses ⭐ in the title). Free users are "Free".
- Points are **XP**. Rankings are the **Leaderboard**. Daily activities are **Daily Missions**.
- Contributors who set their profile to private appear to others under fun single-word aliases (Boba, Mochi, Tofu, Taroko, Alishan). Good material for playful content.
- Handles and links:

| Channel | Link |
|---|---|
| Website | https://halalformosa.com |
| Web app / share links | https://app.halalformosa.com |
| Instagram | https://www.instagram.com/halalformosa/ |
| TikTok | https://www.tiktok.com/@halalformosa |
| Facebook | https://www.facebook.com/halalformosa/ |
| LINE Official | https://line.me/R/ti/p/@975schpu |

---

## 4. The verdict system (most important to get right)

The four status labels are semantic colours and **must not be repurposed** as decoration. The theme file says the brand orange and these status colours are separate palettes.

| Label | Colour | Hex | Meaning |
|---|---|---|---|
| **Halal** | Green (success) | `#2ECC71` | Verified halal |
| **Muslim-friendly** | Blue (primary) | `#3498DB` | No haram ingredients found; not formally certified |
| **Syubhah** | Yellow (warning) | `#F1C40F` | Doubtful; needs checking |
| **Haram** | Red (danger) | `#E74C3C` | Contains haram ingredients |

Rules:
- Spelling: **Halal**, **Muslim-friendly** (hyphen in product copy), **Syubhah**, **Haram**.
- Always show the label text next to the colour. Never rely on colour alone.
- Don't use green, yellow or red for non-verdict decoration in anything showing a scan result.
- Yellow chips use black text. The rest use white.
- Show real app screens for verdicts rather than re-drawing them.

---

## 5. Logo

File: `public/logo-raw/logo.png` (also `assets/icon.png`, same artwork, 1024×1024).

**Anatomy:** white silhouette of Taiwan on a solid orange square. Over it, the word **حلال** in black Arabic calligraphy, with "Halal" in small black type to its left and **Formosa** in large black rounded sans-serif beneath.

**Rules**
- Use the full artwork as supplied. Don't redraw, re-typeset or recolour the map, the calligraphy or the wordmark.
- The orange square is part of the logo. Don't place the logo on busy photos without it.
- Keep clear space around it equal to the height of the "F" in Formosa.
- Minimum size: 48 px for the app-icon form (the smallest icon in `icons/` is 48×48).
- Don't stretch, rotate, add shadows or outlines, or put it inside a different shape.
- Rounded-corner masking is fine, since the app icon is masked by iOS and Android.

**Icon files:** `icons/icon-48…512.webp`, `public/android-chrome-192x192.png`, `public/android-chrome-512x512.png`, `public/apple-touch-icon.png`, `public/favicon*`.

> Not in the repo: a horizontal lockup, a transparent-background version, or a one-colour version. If the video or carousel needs them, ask for them to be created rather than cropping or extracting from this file.

---

## 6. Colour

### Brand accent

| Token | Hex | Use |
|---|---|---|
| **Carrot** (logo orange) | `#E67E22` | Primary brand colour, buttons, highlights, progress, "Question 1 of 14"-style eyebrow labels |
| Carrot shade | `#C96718` | Pressed or focused states, text on light backgrounds when `#E67E22` is too light |
| Carrot tint | `#EA9550` | Soft fills, gradients (the app pairs carrot → carrot-tint) |
| Carrot contrast | `#000000` | Text on orange. The app uses **black on orange**, as the logo does. |

Orange with black text is the signature pairing, so use black (not white) text on solid orange.

### Neutrals

| | Light mode | Dark mode |
|---|---|---|
| App background | `#F7F7F8` | Ionic dark surface (near black) |
| Card | `#FFFFFF` | `#18181A` |
| Card border | `rgba(0,0,0,.07)` | `rgba(255,255,255,.07)` |
| Text | near black | white |

Cards are flat with a hairline border and a barely-there shadow. No heavy drop shadows.

### Pro and tiers

- **Pro / premium accents:** gold, `#FACC15` → `#CA8A04` (gradient), with `#F59E0B` / `#B45309` for rank edges.
- **Tier cards** (Gold, Silver, Bronze) are very subtle tints: gold `#FFFDF7→#FEF6E0`, silver `#FBFCFD→#F1F4F7`, bronze `#FFFCFA→#FDF1E6`.
- Gold is for Pro and top-rank content only.

### Colour hierarchy for marketing

1. Orange `#E67E22` as the dominant brand colour
2. White and the light neutral `#F7F7F8` for breathing room
3. Black for type
4. Status colours **only** to show a scan verdict
5. Gold only for Pro

---

## 7. Typography

- **Typeface:** **Inter** (Google Fonts), weights 400, 500, 600, 700, 800. Fallbacks: system sans (`-apple-system`, `Segoe UI`).
- The logo's "Formosa" is a separate rounded sans-serif, part of the artwork. Don't try to match it with live text; use Inter.
- **Headlines:** Inter 700–800, sentence case.
- **Eyebrow labels:** small, uppercase, bold, orange (e.g. "QUESTION 1 OF 14").
- **Body:** Inter 400–500.
- **Chinese and Arabic text:** use a system CJK or Arabic face (e.g. Noto Sans TC, Noto Sans Arabic) at matching weight. The app doesn't bundle one.
- Sentence case everywhere except eyebrow labels. No all-caps headlines.

---

## 8. Shape, layout and motion

The app's design system is called **"Modern Minimal"**: quiet, spacious, rounded.

- **Corner radius scale:** 10 px (small), 16 px (medium), 22 px (large), 30 px (extra large), pill for chips and buttons. Use these proportions for cards and phone mockups.
- **Layout:** generous padding, one focal element per slide, hairline-bordered cards on a light-grey ground.
- **Navigation motif:** a floating, rounded tab bar with five tabs (Home, Search, Explore, Trip, Store). The selected tab sits in a soft pill.
- **Bottom sheets:** the app uses swipeable bottom-sheet modals for announcements and details. A good motif for "swipe up" moments in video.
- **Motion:** gentle and short. The app has a confetti animation (`public/lottie/Confetti.json`) for celebrations such as points or purchases. Reserve it for moments of reward.
- **Light and dark:** the app supports both. Show whichever fits the post; keep one mode per carousel.

---

## 9. Imagery and screenshots

- **Preferred:** real app screens in a clean phone frame with the radii above, on a flat orange or `#F7F7F8` background.
- **Existing screenshots:** `screenshots/` has the yearly-survey flow (light, dark, Indonesian, Chinese) and admin screens. **The admin screens are internal. Don't use them publicly.** The store screenshots (`01-store-home` … `05-order-result`) are Halal Formosa Store flows.
- **Photography:** real Taiwan food, markets, night-market and convenience-store shelves, mosques, students and travellers. Natural light, no stock-photo staging.
- **Taiwan map silhouette** from the logo can be a background motif at low contrast, but don't crop or recolour the logo file for it.
- **People:** don't use identifiable users or profile photos from the app without permission. Private profiles are masked in the app for a reason. Use aliases (Boba, Mochi, Tofu) or illustrations.
- **Icons:** the app uses Ionicons-style line icons. Keep any added icons the same line weight.

---

## 10. Content do's and don'ts

**Do**
- Show the scan result screen with its label visible.
- Name Taiwan-specific details: 7-Eleven, FamilyMart, night markets, Taroko, Alishan.
- Say that contributions are community-verified and that users earn XP.
- Include a clear call to action: *Download Halal Formosa* with App Store and Google Play badges.
- Add a language-appropriate caption or subtitle to every video.

**Don't**
- Don't present Syubhah or Muslim-friendly as "certified halal".
- Don't quote prices, subscription terms or free-tier limits unless checked against RevenueCat first.
- Don't claim "24/7" support. That wording was deliberately removed from the app.
- Don't compare against named competitors.
- Don't use real user data (names, emails, IDs), partner logos without permission, or admin screenshots.
- Don't use the Arabic word حلال as an ornament or in different fonts. It only appears in the logo.

---

## 11. Quick templates

**Carousel (4:5, 1080×1350)**
1. Hook slide: one bold sentence on orange, black Inter 800.
2. Problem slide: photo of an unreadable Taiwanese label.
3. Solution slides: one phone mockup per feature (scan → verdict → explore).
4. Proof slide: counts of products and locations (pull current numbers from the app's Home stats).
5. CTA slide: logo, "Download Halal Formosa", store badges, @halalformosa.

**Video (9:16, 1080×1920)**
- Hook in the first 2 seconds: the problem, as on-screen text.
- Screen-record a real scan, with the verdict label held on screen for at least 1 second.
- Burned-in subtitles, Inter 700, white on a semi-transparent dark pill, or black on orange.
- End card: logo on orange for at least 2 seconds, plus handle and download CTA.
- Safe zones: keep text out of the top 250 px and bottom 400 px (platform UI overlays).

---

## 12. Open items for the owner

These aren't defined in the codebase, so the next session shouldn't invent them:
- Official **tagline** (the one in section 1 is a proposal).
- **App Store / Google Play badge** assets and store URLs.
- A **horizontal logo**, transparent PNG/SVG and monochrome versions.
- Whether the "Halal" status is applied to certified products only (confirm wording before using "certified").
- Current user, product and location counts for proof slides.
- Dark-mode base surface hex (the app derives it from Ionic's dark palette; only `#18181A` for cards is explicit).
