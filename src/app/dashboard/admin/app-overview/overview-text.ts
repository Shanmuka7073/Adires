
export const overviewText = `
## LocalBasket: Complete Application Overview

This document provides a comprehensive breakdown of the LocalBasket application, covering its purpose, features, user experience, and technical architecture.

---

## 1. How the App Works: The User Journey

LocalBasket is a hyperlocal grocery platform designed to connect users with their neighborhood stores through an intuitive, voice-first interface.

### The Customer Flow:
*   **Discovery**: A user opens the app and can immediately start shopping. They can either use the voice assistant or browse stores and categories manually.
*   **Voice Ordering**: The user activates the mic and says their order in natural language (e.g., "Order one kilo of onions and a packet of milk from Chandra Store"). The AI parses this, identifies the items, quantities, and store, then adds the items to the cart.
*   **Manual Ordering**: Alternatively, the user can browse stores, select products from a store's inventory, and add them to their cart.
*   **Checkout**: The user proceeds to checkout, confirms their delivery address (or selects a new one), and places the order.
*   **Fulfillment**: The selected store receives the new order in their dashboard, prepares it for pickup, and marks it as "Processing" and then "Out for Delivery".
*   **Delivery**: A delivery partner sees the available job, accepts it, picks up the order from the store, and delivers it to the customer.
*   **Confirmation**: The customer receives the order and confirms delivery in their app, or the delivery partner marks it as "Delivered".

### The Store Owner Flow:
*   **Onboarding**: A new store owner signs up and navigates to the "My Store" page. The app automatically creates their store profile using their user information.
*   **Inventory Management**: The owner selects which products from the master catalog they want to sell. Pricing is managed centrally by the admin.
*   **Order Management**: The owner monitors their "Store Orders" dashboard for new orders, updating the status as they fulfill them.

### The Delivery Partner Flow:
*   **Job Discovery**: The partner opens the "Deliveries" dashboard to see a list of available orders ready for pickup, grouped by proximity.
*   **Job Acceptance**: They accept a single order or a group of nearby orders.
*   **Route Optimization**: The app can generate an optimized route for all pickups and drop-offs.
*   **Completion**: After delivering the order, they mark it as "Delivered" and their earnings are updated.

---

## 2. UI and UX Design Philosophy

The application's design is clean, modern, and task-oriented, built with a mobile-first approach.

*   **Component Library**: The entire UI is constructed using **ShadCN UI**, which provides a set of accessible, themeable, and composable React components. This ensures consistency across the app.
*   **Styling**: Styling is handled by **Tailwind CSS**. A central theme is defined in \`globals.css\` using HSL color variables, making it easy to change the entire app's color scheme from one place.
*   **Layout**: The layout is responsive, using cards, grids, and accordions to present information clearly on both mobile and desktop screens. For example, the cart uses a vertical card layout on mobile and a table on desktop.
*   **State Management**: Global state (like stores, products, and user language) is managed by **Zustand**, a lightweight and simple state management library. This prevents prop-drilling and ensures data is consistently available.
*   **User Feedback**: The app provides constant feedback through loading skeletons, spinners, and descriptive toasts for actions like adding to cart or saving changes.

---

## 3. Core Application Features

### For Customers:
*   **Multilingual Voice Commands**: The app's core innovation. It understands complex, mixed-language (e.g., Telugu-English) commands.
*   **Smart Intent Recognition**: The AI can differentiate between intents like ordering an item, checking a price, navigating the app, or asking for a recipe.
*   **AI Recipe Ingredients**: Users can ask "how to make paneer butter masala," and the app will provide a list of ingredients.
*   **Persistent Cart**: The shopping cart is saved to local storage, so it persists even if the user closes their browser.
*   **Real-time Order Tracking**: Order status updates in real-time for customers, store owners, and delivery partners.

### For Admins:
*   **System Status Dashboard**: A real-time view of backend services, database connections, and usage metrics.
*   **AI Training Center**: Admins can view failed voice commands and use the AI to suggest fixes, which can be added to the system's aliases with a single click. This creates a powerful self-improving loop.
*   **Centralized Product Management**: The admin manages a "Master Store" that holds the canonical list of all products and their prices, ensuring consistency across the platform.
*   **Voice Alias Management**: A dedicated dashboard to view and manage all voice command aliases for products, stores, and general actions.

### For Store Owners:
*   **Instant Onboarding**: AI-assisted store creation gets a new store online in seconds.
*   **Simple Inventory Selection**: Store owners simply check boxes to choose which products from the master catalog they wish to sell.
*   **Real-time Order Dashboard**: A clear view of incoming and active orders, with simple status update controls.

---

## 4. How the Voice Commander Works

The voice commander is the brain of the application. It's a complex system that orchestrates a series of steps to understand and act upon user speech.

*   **Activation**: When the user clicks the microphone icon, the browser's `SpeechRecognition` API is activated. It listens for speech in the user's selected language (e.g., 'en-IN' or 'te-IN').
*   **Transcription**: The browser converts the speech to text.
*   **Intent Recognition**: The transcribed text is passed to the \`recognizeIntent\` function. This function uses a series of keyword checks and logic to determine what the user is trying to do (e.g., \`ORDER_ITEM\`, \`CHECK_PRICE\`, \`NAVIGATE\`).
*   **Entity Extraction**: If the intent is to order an item, the \`findProductAndVariant\` function is called. It uses a fuzzy-matching algorithm (\`calculateSimilarity\`) to compare the user's phrase against a pre-built map of all known product aliases (\`universalProductAliasMap\`). It identifies the product, quantity, and the most likely variant (e.g., "1kg").
*   **Contextual Awareness**: The commander is context-aware. If the user is on the checkout page, it will prompt for missing information like the delivery address or store. If it just quoted a price, it will listen for a "yes" or "no" to add the item to the cart.
*   **Action Execution**: Once the intent and entities are clear, the commander calls the appropriate action, whether it's navigating to a new page (\`router.push\`), adding an item to the cart (\`addItemToCart\`), or speaking a reply to the user.
*   **AI Speech Synthesis**: Replies are spoken back to the user using the browser's `SpeechSynthesis` API, with a voice selected to match the user's language.
*   **Failure Logging**: If a command cannot be understood, it is automatically logged to the \`failedCommands\` collection in Firestore, making it available for the admin to review and fix in the "Failed Command Center".
`;
