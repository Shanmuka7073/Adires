// This file is purely for storing the large string of text for the overview page.
// It is not a React component.

export const overviewText = `
## 🚀 App Overview

This document provides a comprehensive overview of the LocalBasket application, detailing its features, architecture, and key components.

---

### Core Features

*   **Dual User Roles**: The app supports both regular **Customers** and **Store Owners**. A special **Admin** role (email-based) has access to a system-wide dashboard.
*   **Voice Commander**: A global, always-on voice assistant that can be activated to perform a wide range of actions, from navigation to placing complex orders.
*   **Dynamic Inventory**: Store owners can manage their product inventory by selecting items from a **Master Product Catalog** maintained by the admin.
*   **Centralized Pricing**: Product prices are not set by individual stores. Instead, they are managed centrally in a \`productPrices\` collection by the admin to ensure consistency.
*   **AI-Powered Features**:
    *   **Recipe Ingredient Generation**: Users can ask for a recipe for a dish, and an AI will provide the ingredients.
    *   **Alias Learning**: The system logs failed voice commands. An admin can review these failures and use an AI flow to suggest new aliases, which retrains the NLU.
    *   **Automated Pack Generation**: An AI can generate weekly or monthly grocery packs for customers based on family size and preferences.
*   **Geolocation & PWA**: The app is a Progressive Web App (PWA) and uses geolocation to sort stores by distance.

---

### Key Technical Components

*   **`src/lib/store.ts` (Zustand Global Store)**: This is the client-side single source of truth. It fetches and holds all essential data on startup (stores, master products, voice aliases) to ensure the app is fast and responsive without constant re-fetching.
*   **`src/app/page.tsx` (Homepage)**: This is the main entry point, showcasing product categories and providing the primary search/voice interface.
*   **`src/app/stores/[id]/page.tsx` (Store Detail Page)**: Displays products for a selected store, filtered by category. It relies on the data from the global store.
*   **`src/components/layout/voice-commander.tsx` (The Brain)**: This is the most complex component. It handles:
    *   Speech recognition via the Web Speech API.
    *   Natural Language Understanding (NLU) to parse commands.
    *   Intent recognition (e.g., is the user ordering, navigating, or asking a question?).
    *   Contextual conversation (e.g., asking for clarification after a price check).
*   **`src/lib/nlu/` (NLU Engine)**: A set of files responsible for parsing numbers, units, and product names from raw text.
*   **`src/app/actions.ts` (Server Actions)**: Secure server-side functions used for tasks that require admin privileges, like bulk-importing products.
*   **`src/app/api/auth/` (API Routes)**: Handles the backend logic for secure WebAuthn (Fingerprint) login.
*   **`src/firebase/`**: Contains all Firebase configuration and custom hooks (`useCollection`, `useDoc`) for real-time data fetching.

---

### Data Flow for an Order

1.  **User Speaks**: "Order 1kg potatoes from FreshMart to my home."
2.  **VoiceCommander**: Captures the audio and transcribes it to text.
3.  **NLU Engine**: The text is passed to \`runNLU\`, which identifies "1kg" as a quantity and "potatoes" as the product phrase.
4.  **Intent Recognition**: The commander recognizes this as a 'SMART_ORDER' intent because it contains a product, a store name, and a destination.
5.  **Alias Matching**:
    *   "potatoes" is matched to the canonical 'potatoes' product from the \`universalProductAliasMap\`.
    *   "freshmart" is matched to the "FreshMart" store in the \`storeAliasMap\`.
    *   "home" is recognized as a keyword for the user's saved address.
6.  **Execution**:
    *   The cart is cleared for a new smart order.
    *   The correct product and variant ('1kg') are added to the cart.
    *   The active store is set to "FreshMart".
    *   The user's home address is set for delivery.
    *   The user is navigated to the \`/checkout\` page.
    *   A flag is set to tell the checkout page to auto-submit the order.
`;
`
]];
