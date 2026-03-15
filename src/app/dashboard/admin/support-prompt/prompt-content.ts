
'use client';

/**
 * @fileOverview This file constructs the comprehensive system prompt for AI support.
 * It pulls together architecture, data schema, and operational logic.
 */

import { rulesText } from '../security-rules/rules-text';
import { overviewText } from '../app-overview/overview-text';
import { auditText } from '../performance-audit/audit-text';

export function generateSupportPrompt() {
  return `
# APPLICATION CONTEXT FOR AI SUPPORT
Role: Senior Firebase & Next.js Developer
App Name: LocalBasket (Multi-Vertical Platform)

## 1. TECH STACK & ARCHITECTURE
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS, ShadCN, Lucide Icons, Framer Motion
- State: Zustand (with Persistence)
- Backend: Firebase (Auth, Firestore, Storage)
- Generative AI: Genkit (Gemini 1.5 Flash)

## 2. DATA STRATEGY (CRITICAL)
The platform uses **Behavioral Discrimination** instead of business-specific collections:
- **Retail Vertical (Grocery/Dairy)**: Uses the \`products\` subcollection. Items have weights, stock, and variants.
- **Service Vertical (Restaurant/Salon)**: Uses the \`menus\` subcollection. Items have "Components" and "Steps."
- **Unified Orders**: All transactions live in \`/orders\`. A \`businessType\` or store name check determines if the UI shows "Book Appointment" (Salon) or "Place Order" (Restaurant/Retail).

## 3. CORE OPERATIONAL MODES
- **Dine-in / At-Salon**: Triggered via QR codes with \`?table=X\`. Uses table-based session IDs to group orders into a single bill.
- **Appointment Booking**: Specifically for Salons. Requires Date/Time selection and captures \`appointmentTime\` in the Order document.
- **Home Delivery**: Requires Name, Phone, and Address (pinned via One-Tap GPS) before checkout.
- **Biometric Identity**: Uses WebAuthn (Fingerprint) and Voice ID for secure authentication.

## 4. KEY DATA ENTITIES
- /users/{userId}: Profile + accountType.
- /stores/{storeId}: Metadata, locations, tables, and UPI IDs for payment.
- /orders/{orderId}: Transaction records. Statuses: Draft, Pending, Processing, Billed, Delivered, Completed.
- /productPrices/{productName}: Canonical pricing source for Retail items.
- /restaurantIngredients: Master cost catalog for calculating Gross Profit.

## 5. CURRENT SYSTEM OVERVIEW
${overviewText}

## 6. PERFORMANCE AUDIT & BOTTLENECKS
${auditText}

## 7. ACTIVE SECURITY RULES
\`\`\`rules
${rulesText}
\`\`\`

## 8. SPECIFIC PROBLEM CONTEXT
[USER: PLEASE PASTE YOUR SPECIFIC ERROR MESSAGE OR QUESTION HERE]
`.trim();
}
