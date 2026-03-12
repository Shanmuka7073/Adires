
// This file stores the comprehensive overview of the LocalBasket platform for the Admin Dashboard.

export const overviewText = `
## 🚀 LocalBasket: Total Platform Overview

LocalBasket is a multi-role hyperlocal grocery and restaurant platform. It leverages AI, Voice control, and PWA technology to bridge the gap between neighborhood shops and digital-first customers.

---

### 🥗 1. Restaurant POS & Table Management
The app turns any restaurant into a high-tech operation with zero hardware cost.

*   **AI Menu Scanning**: Owners don't type. They upload a photo of a paper menu. The AI extracts names, prices, categories, and ingredients.
*   **Dynamic Floor Map**: The "Store Orders" dashboard shows every table in the restaurant. It highlights which tables are active, which are waiting for food, and which are ready to pay ("Billed").
*   **Kitchen Display System (KDS)**: Home deliveries appear at the top, while table orders appear on the map. The kitchen can "Accept" and "Process" orders in real-time.
*   **QR Table Ordering**: Each table gets a unique QR code. When scanned, it opens a customized web app for that specific table. Guests can order and add to their bill without calling a waiter.

---

### 🚚 2. Home Delivery & Logistics
Built for precision and speed in the Indian context.

*   **GPS Pinning**: Customers can use a "One-Tap GPS" button to pin their exact delivery location, which is then passed directly to Google Maps for the delivery partner.
*   **Live Tracker**: Once an order is "Out for Delivery," the customer sees a live status bar and a **20-minute arrival countdown**.
*   **Live Prep Video**: Customers can watch a live stream of the kitchen (configured via Site Config) while waiting for their food.
*   **Geographic Partitioning**: Orders are tagged with a \`zoneId\` (pincode). Delivery partners only see jobs in their specific zone, ensuring the system scales to millions of users without slowing down.

---

### 📱 3. The "Install App" (PWA) Feature
We use Progressive Web App technology to act like a native Android/iOS app.

*   **Platform Install**: The main LocalBasket app can be installed from the browser.
*   **Restaurant Branding**: Crucially, every restaurant has its own **Dynamic Manifest**. When a user scans a QR code for "Paradise Biryani," they can install *just* that restaurant as a separate icon on their home screen.
*   **Push Notifications**: The system integrates with Firebase Cloud Messaging (FCM) to send status updates directly to the user's phone.

---

### 🎙️ 4. Voice ID & NLU Engine
The "Brain" of the platform.

*   **Multilingual NLU**: Our custom engine understands English, Telugu, and Hindi mixed sentences. It can extract quantities (1kg, 250gm), prices (50 rupees), and products simultaneously.
*   **Voice ID**: A biometric feature allowing users to enroll their voice as a secure password for one-tap logins.
*   **Alias Learning**: If the voice engine fails, it logs the error. The Admin reviews these in the "Failed Command Center" and creates new "Aliases" to teach the app new words.

---

### 📈 5. Business Economics & Intelligence
Turning data into profit.

*   **Ingredient Cost Catalog**: Admins maintain a master list of raw ingredient costs (e.g., Rice at ₹60/kg).
*   **Recipe Snapshots**: When a dish is ordered, the app takes a "snapshot" of its current ingredient costs.
*   **Gross Profit Analysis**: The "Sales Report" calculates the exact profit for every dish and every table by subtracting the snapshot ingredient cost from the selling price.
*   **Waste Reduction**: By tracking ingredient consumption, owners can see exactly how much stock they should be buying.
`;
