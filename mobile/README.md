# WebGIS-React-Native 📱🗺️

A universal mobile-first template for modern **WebGIS** and **interactive mapping** apps. Built with **React Native**, **Expo**, and **OpenStreetMap**, this project integrates seamlessly with the [WebGIS-Django backend](https://github.com/GeoBradDev/WebGIS-Django) to power full-stack spatial applications on Android and iOS.

---

## 🚀 Quick Start with the Backend Script

Use the `bootstrap.sh` script from the backend project to spin up everything at once:

```bash
bash <(curl -s https://raw.githubusercontent.com/GeoBradDev/WebGIS-Django/main/scripts/bootstrap.sh)
````

This will:

* Clone both frontend and backend repositories
* Install required system dependencies
* Set up a PostGIS-enabled PostgreSQL database
* Configure environment variables and virtualenv
* Start both frontend (mobile) and backend development servers

---

## 🌟 Features

* 🗺️ **Interactive Mobile Map** – Built with `react-native-maps`, supports OpenStreetMap tiles, markers, and polylines
* 🧭 **Location Search** – Integrated with Nominatim for forward/reverse geocoding
* 📦 **Zustand State Management** – Simple, scalable global state handling
* 🧱 **Modular Components** – Reusable components and hooks for clean architecture
* 🪶 **Expo + React Native** – Works on both Android and iOS via Expo Go

---

## 🛠️ Tech Stack

| Technology            | Purpose                           |
| --------------------- | --------------------------------- |
| **React Native**      | Mobile frontend framework         |
| **Expo**              | Rapid development & deployment    |
| **react-native-maps** | Map rendering using OpenStreetMap |
| **Zustand**           | Lightweight state management      |
| **Nominatim API**     | Geocoding and reverse geocoding   |

---

## ⚡ Manual Setup

### Prerequisites

* Node.js (v18+ recommended)
* npm
* Expo CLI: `npm install -g expo-cli`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/GeoBradDev/WebGIS-React-Native.git

# 2. Navigate to the project directory
cd mobile

# 3. Install dependencies
npm install

# 4. Start the Expo development server
npx expo start
```

> You can run the app on your Android/iOS device using the **Expo Go** app or in an emulator.

---

## 📁 Project Structure

```
WebGIS-React-Native/
├── assets/            # Images, icons, fonts
├── components/        # Reusable UI and map components
├── constants/         # Configuration (e.g., tile URLs, colors)
├── hooks/             # Custom hooks (e.g., useGeolocation, useGeocoder)
├── store/             # Zustand global state
├── screens/           # App screens (e.g., MapScreen)
├── App.tsx            # Main application entry
├── app.config.js      # Expo configuration
└── README.md          # Project documentation
```

---

## 🧪 Usage

### Map Component

* Built with `react-native-maps` and `UrlTile` for OpenStreetMap tiles
* Customize markers, polylines, heatmaps, and more
* Add real-time geolocation tracking and auto-centering

### Search

* Search for a location using Nominatim
* Map pans and zooms to the result
* Reverse geocoding supported from tapped map coordinates

### State Management

* Zustand is used to manage global app state (e.g., location, search result, layer toggles)

---

## 🛠 Customization

### Tile Source

Update your OpenStreetMap or custom tile layer:

```tsx
<UrlTile
  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  maximumZ={19}
/>
```

### Environment Variables

Create a `.env` file in the root:

```env
API_URL=http://localhost:8000/api
```

Then access via `process.env.API_URL` using `expo-constants` or another config loader.

### Feature Ideas

* 🔥 Add heatmap overlay or segment-based speed visualization
* 📍 Integrate background location tracking
* 🌐 Add multilingual UI
* 🗂️ Sync user layers with backend API

---

## 🧭 Roadmap: PMTiles / MapLibre parity with the web client

The web client (`frontend/`) renders **PMTiles vector basemaps** via MapLibre GL JS. The mobile client still uses `react-native-maps` and does **not** support PMTiles yet. To bring it to parity:

1. Replace `react-native-maps` with [`@maplibre/maplibre-react-native`](https://github.com/maplibre/maplibre-react-native), which supports MapLibre styles and the `pmtiles://` protocol.
2. Switch to an **Expo dev build** (`expo-dev-client` is already a dependency) since MapLibre Native is a custom native module not available in Expo Go.
3. Point the basemap at the same PMTiles archive the web client uses (DO Spaces), and reuse the Protomaps basemap style.

This is intentionally deferred: it requires native modules and a dev build, and mobile is not part of the containerized App Platform deployment (it ships via EAS / the app stores).

---

## 🔗 Backend Integration

Designed to work out-of-the-box with:

👉 **[WebGIS-Django Backend](https://github.com/GeoBradDev/WebGIS-Django)** – Featuring Django Ninja, headless Django Allauth, and PostGIS support

---

## 🤝 Contributing

Pull requests and issues are welcome! Help us improve this template for the next generation of mobile WebGIS apps.

---

## 📄 License

MIT © [GeoBrad.dev](https://geobrad.dev)

---

## 🙏 Acknowledgments

* [React Native](https://reactnative.dev/)
* [Expo](https://expo.dev/)
* [react-native-maps](https://github.com/react-native-maps/react-native-maps)
* [OpenStreetMap / Nominatim](https://nominatim.openstreetmap.org/)
