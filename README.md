# 🇹🇼 Halal Formosa

[![Maintainer](https://img.shields.io/badge/Maintained%20by-R%20Creative-orange.svg)](https://github.com/rakharamadhana)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-emerald.svg)](https://vuejs.org/)
[![Ionic Framework](https://img.shields.io/badge/Ionic-Vue-blue.svg)](https://ionicframework.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Halal Formosa** is a state-of-the-art hybrid mobile application engineered to empower the Muslim community and travelers in Taiwan. It offers a comprehensive digital companion to check food halal status, track daily missions, locate prayer times/mosques, and find verified Muslim-friendly establishments.

Built on a premium, immersive dark-themed design system using **Vue 3 (Setup)**, **Ionic Vue**, **Capacitor Native**, and **Supabase Backend Services**.

---

## 🌟 Core Features

### 1. 🔍 Intelligent Scan Suite
* **Barcode Scanner**: Instantly scans product barcodes to query the Supabase product registry and fetch halal statuses, certifications, and details.
* **OCR Ingredients Analyzer**: Scans and parses textual ingredient lists using advanced OCR to identify and flag doubtful (*Mushbooh*) or non-halal items.

### 2. 🗺️ Immersive Geo-Location & Maps
* **Interactive Maps**: Explores nearby verified restaurants, shops, and mosques.
* **Interactive Direction Routing**: Calculates real-time routes from your current coordinates.
* **Prayer Time Schedule**: Deterministic prayer time calculations dynamically adjusted to your geolocation using `praytime.js`.

### 3. 🏆 Leaderboard & Daily Missions
* **Daily Challenges**: Complete interactive daily activities (e.g. scanning products, checking places) to claim XP bonuses.
* **Gamified Leaderboard**: Tracks top contributors with dynamic levels, customized point thresholds, and interactive profiles.
* **Premium Client-Side Privacy**: If a contributor's profile is set to Private:
  * **To others**: They show up as fun, deterministically assigned single-word local aliases (e.g. *Boba*, *Mochi*, *Tofu*, *Taroko*, *Alishan*).
  * **To themselves**: The profile remains unmasked, showing their real name and avatar decorated with a clean `"Private"` information tag.

### 4. 📢 Bottom-Sheet Announcements
* **Rich HTML Popups**: Delivers beautiful in-app notifications and news updates via swipeable Ionic bottom-sheet modals supporting responsive images and rich-text contents.

### 5. 💎 Pro Memberships & Direct Support
* **RevenueCat Integration**: Enables digital subscription flows for premium members natively.
* **Boba Donations**: Supports direct integrations to buy a cup of Boba tea to support voluntary development.

### 6. 🔗 Symmetrical Social Hub
* Beautifully organized 2x2+1 grid integration on the profile screen connecting you directly to our community channels:
  * 📸 **Instagram**
  * 💬 **LINE Official**
  * 🎵 **TikTok**
  * 📘 **Facebook**
  * 🌐 **Official Website**

---

## 🛠️ Tech Stack & Services

* **Frontend Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
* **UI Ecosystem**: [Ionic Framework Vue](https://ionicframework.com/docs/vue)
* **Mobile Runtime**: [Capacitor](https://capacitorjs.com/) for compiler targeting iOS and Android builds
* **Backend Database & Authentication**: [Supabase Enterprise](https://supabase.com/)
* **Geolocation & Direction Engine**: Google Maps JavaScript API
* **Privacy Compliance**: iOS App Tracking Transparency (ATT) natively integrated
* **Anti-Abuse**: Invisible Google reCAPTCHA Enterprise verification on secure database writes

---

## 🚀 Easy Development Setup

New to the project? Follow this streamlined walkthrough to get your local environment running in minutes.

### 📋 Prerequisites
* **Node.js**: `v18.x` or higher (LTS recommended)
* **Ionic CLI**: Installed globally via `npm install -g @ionic/cli`

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/rakharamadhana/halal-project.git
cd halal-project
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Configure Environment Secrets
1. Duplicate the template file to initialize your local environment:
   ```bash
   cp .env.example .env
   ```
2. Open [.env](file:///c:/Users/User/halal-project/.env) and populate it with your development keys. Refer to the grouped sections in [.env.example](file:///c:/Users/User/halal-project/.env.example) for notes on Supabase endpoints, AdMob banner keys, and reCAPTCHA integrations.

### 4️⃣ Start the Dev Server
Launch the local Ionic hot-reloading dev server:
```bash
ionic serve
```
Your browser will automatically open to `http://localhost:8100` (or whichever port is assigned).

---

## 📦 Mobile Platform Builds

Compiling hybrid packages for mobile devices is fully automated:

### iOS (Xcode)
```bash
# 1. Compile web bundle
ionic build

# 2. Sync web assets to iOS workspace
ionic cap sync ios

# 3. Launch Xcode to compile & run on emulator/device
ionic cap open ios
```

### Android (Android Studio)
```bash
# 1. Compile web bundle
ionic build

# 2. Sync web assets to Android workspace
ionic cap sync android

# 3. Launch Android Studio to compile & run
ionic cap open android
```

---

## 🤝 Guide for Contributors

We love contributions! Follow these steps to submit clean code additions:

1. **Fork** the repository and create your feature branch: `git checkout -b feature/awesome-addition`.
2. Ensure your environmental configurations match [.env.example](file:///c:/Users/User/halal-project/.env.example).
3. Commit your changes: `git commit -m 'feat: add amazing new feature'`.
4. Push to your branch: `git push origin feature/awesome-addition`.
5. Open a **Pull Request** detailing what your changes accomplish.

---

## 📄 License
This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it.

---

> **Maintained by [R Creative](https://github.com/rakharamadhana)** 🇹🇼  
> *Dedicated to empowering and supporting the Muslim community in Taiwan.*
