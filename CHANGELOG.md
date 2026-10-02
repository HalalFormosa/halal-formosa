# Changelog

## 2.0 (unreleased)

### Design
- New "modern-minimal" design system, with tokens rolled out across every screen.
- Redesigned global shell: floating tab bar and refined header.
- Redesigned auth screens (Login/Sign Up/Update Password) and the profile menu.
- Structural redesign of core screens — flatter cards, fewer nested borders/shadows, softer overall look.
- Explore: full-viewport map and a redesigned filter sheet.
- Search, Store, and Trip: floating/frosted search bars, reworked pull-to-refresh, bigger icons, sort moved into the filter sheet.
- Product Details: merged into a single flowing sheet instead of separate cards.

### New features
- Live barcode scanning with a camera overlay, plus barcode scanning from the photo gallery.
- Live auto-scan (OCR) ingredient analysis, with daily scan limits.
- LINE Login, with a linked-accounts view for managing connected sign-in methods.
- In-app notifications: bell icon and badges for approvals, rejections, and report replies.
- Android home screen widget (light/dark, 3 sizes).
- Offline handling for scanning — connectivity checks and clearer offline feedback.
- Admin: overhauled product review UI, photo-based duplicate detection, pending/archived counts on review tabs, and expanded engagement analytics.

### Fixes & reliability
- Improved sign-up and login reliability on native builds.
- Fixed contributor approvals that could silently fail under certain conditions.
- Tightened barcode format validation (UPC-E).
- Fixed daily missions detection scope and notification badge behavior.
- Fixed various layout issues: stray CSS leaks, stretched Android back button, header button styling.
- Fixed ad refresh and OCR keyword matching bugs.

### Removed
- Removed the donation feature (superseded by LINE Login work).

---

## 1.x

_Prior history not yet documented — see git log for details._
