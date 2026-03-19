
// This file stores the comprehensive overview of the LocalBasket platform for the Admin Dashboard.

export const overviewText = `
## 🚀 Adires: The Advanced Unified Market Platform

Adires (formerly LocalBasket) is a high-performance, multi-role market hub designed for the Indian context. It bridges the gap between neighborhood commerce and digital-first expectations using cutting-edge PWA, AI, and Biometric technologies.

---

### 🏛️ 1. Multi-Vertical Data Architecture
The platform supports **Restaurants, Salons, and Retailers** using a **Unified Behavioral Schema**. 

*   **Behavioral Collections**: Instead of duplicate logic for different stores, we use operational nature:
    *   **Retail/Dairy**: Focuses on standardized goods, variants, and stock management.
    *   **Service/Menu**: Focuses on craft-based items, preparation time, and session management.
*   **Zero-Friction Vertical Sync**: The app automatically identifies business types via explicit metadata or heuristic keyword matching (e.g., detecting "Biryani" implies Restaurant mode).

---

### 📲 2. Instant App Download (PWA)
Adires is a **Progressive Web App (PWA)**, meaning it provides a "Native App" experience with zero app store friction.

*   **Instant Install**: Users can "Add to Home Screen" in one tap from any browser.
*   **Standalone Shell**: Once installed, the app runs without browser bars, providing a dedicated full-screen experience.
*   **Automatic Updates**: The Service Worker silently updates the app shell in the background, ensuring all users are always on the latest version.

---

### ⚡ 3. The "Local-First" Performance Engine
We prioritize speed and cost-efficiency using **Operational Indexing** and **Persistent Cache**.

*   **Sub-200ms Response**: By persisting the user's identity and core platform data in \`localStorage\`, the UI unlocks instantly before the first database request even returns.
*   **The N+1 Fix**: We use **Embedded Item Arrays** in orders. Instead of reading subcollections, 1 read returns the entire table bill, reducing Firestore costs by over 90%.
*   **Offline Resilience**: All business actions (Punch-in, Order Confirmation) use **Optimistic Writes**. They are saved to local memory immediately and sync to the cloud once signal is restored.

---

### 🎙️ 4. Multilingual NLU & Voice ID
The "Brain" of the platform is built for India's multilingual reality.

*   **Regional NLU**: Understands English, Telugu, and Hindi mixed sentences. It can extract "one kg chicken" and "500gm onions" from a single spoken phrase.
*   **Individual Data Continuity**: Every user (even guests) is assigned a persistent \`deviceId\`. This ensures that "Individual Data" like order history and favorites are preserved across visits.
*   **Voice ID Biometrics**: Users can enroll their voice as a secure key, allowing them to verify transactions or log in using only their speech patterns.

---

### 🥗 5. Restaurant & Salon Operations (POS)
The app turns any shop into a high-tech operation with **zero hardware cost**.

*   **AI Menu Scanning**: Owners upload a photo of a menu; the AI extracts items and prices instantly.
*   **Floor Map & QR**: Each table/chair gets a unique QR code. Scans automatically link to a \`sessionId\`, grouping orders for that specific visit.
*   **Live Prep Feeds**: Integrated video support allows customers to watch their food being prepared in real-time, building massive brand trust.

---

### 📉 6. Economic Intelligence & Gross Profit
*   **Cost Drivers**: The app tracks master ingredient costs and maps them to menu items.
*   **Margin Analysis**: Owners see the exact **Gross Profit** for every dish and every table, identifying exactly where money is being made or lost.
*   **Optimization Hints**: AI analyzes cost patterns and suggests specific price or portion corrections to reach a 55% target margin.

---

### 🔒 7. Advanced Security & Auth
*   **Biometric Hub**: Supports both **Fingerprint (WebAuthn)** and **Voice ID** for military-grade, passwordless security.
*   **Contextual Permissions**: Firestore Security Rules ensure owners only see their store, delivery partners only see jobs in their \`zoneId\`, and customers only see their own private history.
`;
