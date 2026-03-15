
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
App Name: LocalBasket (Adires Branding)

## 1. TECH STACK & ARCHITECTURE
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- UI: Tailwind CSS, ShadCN, Lucide Icons
- State Management: Zustand (with persistence)
- Backend: Firebase (Auth, Firestore, Storage)
- Generative AI: Genkit (Google AI Plugin / Gemini 1.5 Flash)

## 2. CORE OPERATIONAL MODES
- **Dine-in (Table Service)**: Triggered via QR codes with ?table=X parameter. Uses table-based session IDs to group orders into a single bill.
- **Home Delivery**: Defaults to this mode if no table param is present. Requires Name, Phone, and Address (pinned via One-Tap GPS) before checkout.
- **Biometric Identity**: Uses WebAuthn (Fingerprint) and Voice ID (simulated feature vectors) for secure, passwordless login.

## 3. KEY DATA ENTITIES (FIRESTORE)
- /users/{userId}: Basic profile + accountType (groceries, restaurant, employee).
- /stores/{storeId}: Metadata, locations, tables, and UPI IDs for payment.
- /stores/{storeId}/products/{productId}: Master product links (one store acts as the 'LocalBasket' master catalog).
- /orders/{orderId}: Transaction records. Statuses: Pending, Processing, Billed, Delivered, Completed.
- /productPrices/{productName}: The source of truth for canonical pricing and stock levels across the platform.
- /employeeProfiles/{userId}: Professional data linked to a store and a manager.

## 4. CURRENT SYSTEM OVERVIEW
${overviewText}

## 5. PERFORMANCE AUDIT & BOTTLENECKS
${auditText}

## 6. ACTIVE SECURITY RULES
\`\`\`rules
${rulesText}
\`\`\`

## 7. SPECIFIC PROBLEM CONTEXT
[USER: PLEASE PASTE YOUR SPECIFIC ERROR MESSAGE OR QUESTION HERE]
`.trim();
}
