
// This file stores the comprehensive overview of the LocalBasket platform for the Admin Dashboard.

export const overviewText = `
## 🚀 LocalBasket: Total Platform Overview

LocalBasket is a multi-role hyperlocal grocery and restaurant platform. It leverages AI, Voice control, and PWA technology to bridge the gap between neighborhood shops and digital-first customers.

---

### 🏛️ 1. Multi-Vertical Data Architecture
The platform is designed to support Restaurants, Salons, and Retailers using a **Unified Behavioral Schema**. 

*   **Behavioral Collections**: Instead of business-specific collections (like 'salonServices'), we use operational nature:
    *   **Catalog Items (Retail/Dairy)**: Standardized goods with variants and stock levels.
    *   **Service/Menu Items (Restaurant/Salon)**: Craft-based items requiring preparation or scheduling.
*   **The Benefit**: This allows the AI to apply different logic (e.g., weight validation for retail vs. time-slot validation for salons) while keeping the database lean and fast.

---

### 🥗 2. Restaurant & Salon Operations
The app turns any service business into a high-tech operation with zero hardware cost.

*   **AI Menu Scanning**: Owners upload a photo of a menu. The AI extracts names, prices, categories, and components (ingredients for food, materials for salons).
*   **Dynamic Floor Map**: The "Store Orders" dashboard shows every table/chair. It highlights which are active, waiting, or ready to pay ("Billed").
*   **Integrated Booking**: For Salons, the app automatically switches to a "Book Appointment" flow with a date scroller and time picker.
*   **QR Ordering**: Each table/chair gets a unique QR code. Guests can order or book directly from their phone.

---

### 🚚 3. Home Delivery & Logistics
Built for precision and speed in the Indian context.

*   **GPS Pinning**: Customers use a "One-Tap GPS" button to pin their location, passed directly to Google Maps for delivery partners.
*   **Live Tracker**: Customers see a live status bar and a **20-minute arrival countdown**.
*   **Geographic Partitioning**: Orders are tagged with a \`zoneId\` (pincode). Partners only see jobs in their specific zone, ensuring global scalability.

---

### 🎙️ 4. Voice ID & NLU Engine
The "Brain" of the platform.

*   **Multilingual NLU**: Understands English, Telugu, and Hindi mixed sentences. It extracts quantities, prices, and products simultaneously.
*   **Voice ID**: A biometric feature allowing users to enroll their voice as a secure key for authentication.
*   **Self-Learning**: Failed commands are logged for Admin review to teach the app new regional aliases.

---

### 📈 5. Business Economics & Intelligence
*   **Ingredient Cost Catalog**: Admins maintain master raw material costs.
*   **Gross Profit Analysis**: The app calculates exact profit for every dish/service and every table by subtracting ingredient/material costs from the selling price.
`;
