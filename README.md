# Places Alarm - Spatial Reminder System

**Places Alarm** is a location-based reminder application that alerts you when you are near specific places or generic categories (like "Pharmacies" or "Bakeries"). It combines an interactive map, task management, and intelligent spatial alerts.

---

## 🚀 Features

### 🌍 **Map & Location**
- **Interactive Full-Screen Map**: Uses Google Maps tiles for familiarity and clarity.
- **Draggable Pins**: Long-press or select a pin to drag it to a precise location.
- **Local Search**: Search for specific places or categories (e.g., "Cafe") near you.
- **Draft Mode**: Click anywhere to drop a temporary pin, name it, and add notes before saving.

### 🔔 **Smart Alerts**
- **Proximity Detection**: Triggers alerts when you enter the radius of a saved place.
- **Audio Feedback**:
  1.  **Immediate Beep**: A gentle sound to grab attention.
  2.  **Voice Narration**: Speaks "You are near [Place Name]" clearly (delayed by 1s).
- **Snooze & Dismiss**:
  - **Snooze**: Silences the alert for 5 minutes.
  - **Dismiss**: Silences the alert until you leave the area and return.

### 📝 **Task & Notes Management**
- **Checkpoints**: Manage your to-do list geographically.
- **AI-Powered Notes**: If you don't add a note, Gemini AI suggests one based on the place name.
- **Customizable Radius**: Set the alert distance (50m - 1km) for each place.
- **Categories**: Places are automatically categorized (Work, Home, Shop, Food, etc.) with color-coded badges.

---

## 📖 User Guide

### 1. Adding a Place
- **Method A (Search)**: Use the search bar in the top-left sidebar. Click a result to fly to it.
- **Method B (Map Drop)**: Click anywhere on the map.
  - A "New Location" pin appears.
  - A panel at the bottom allows you to name it (e.g., "My Parking Spot") and add notes.
  - You can drag the pin to adjust the position before clicking **Add Pin**.

### 2. Managing Alerts
- When you are near a saved place, an alert card appears at the top right.
- **"OK, GOT IT"**: Dismisses the alert for this visit.
- **"SNOOZE"**: Reminds you again in 5 minutes.

### 3. Editing Places
- Click any pin or list item to open the **Details Panel** (bottom right).
- **Edit Name/Notes**: Click the pencil icon to modify text.
- **Adjust Radius**: Use the slider to change how close you need to be to trigger an alert.
- **Move Pin**: You can drag the marker on the map while the details panel is open. The alert logic automatically resets for the new location.

---

## 🛠 Developer Setup

### Prerequisites
- Node.js installed.
- A Google Gemini API Key (for AI features).

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up environment variables:
    - Create a `.env` file (or use your platform's secrets manager).
    - Add `API_KEY=your_gemini_api_key`.

### Running
```bash
npm start
```

### Architecture
- **Framework**: React 18 + TypeScript
- **Map Library**: React Leaflet / Leaflet
- **Styling**: Tailwind CSS
- **State Management**: React `useState` / `useEffect` (Local State)
- **Services**:
  - `locationService.ts`: Geolocation and distance calculations.
  - `geminiService.ts`: AI integration for categorization and note generation.

---

## 📸 Notes
- The app requires **Location Permissions** to function.
- **Audio Alerts** require user interaction with the page at least once (browser policy).
