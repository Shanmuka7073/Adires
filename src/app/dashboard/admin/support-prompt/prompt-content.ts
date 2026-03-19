
'use client';

import { rulesText } from '../security-rules/rules-text';
import { overviewText } from '../app-overview/overview-text';
import { auditText } from '../performance-audit/audit-text';

export function generateSupportPrompt() {
  return `
# APPLICATION CONTEXT FOR AI SUPPORT
Role: Senior Firebase & Next.js Developer
App Name: Adires (formerly LocalBasket)

## 1. STRATEGIC VISION & PRD
- Style: Soft Green (#90EE90) to evoke freshness.
- Background: Very light green (#F0FFF0), near-white backdrop.
- Accent: Light orange (#FFB347) for key CTAs.
- Font: 'PT Sans' sans-serif for headlines and body.
- Core: Hyperlocal empowerment. Connecting users to trusted neighborhood stores, not warehouses.

## 2. TECH STACK
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS, ShadCN
- State: Zustand (Persisted for offline-ready identity)
- Backend: Firebase Client SDK ONLY

## 3. OPTIMIZED DATA STRATEGY (CRITICAL)
The platform uses "Operational Indexing" to protect the Firestore budget:
- **isActive: true**: Used in /orders. dashboards only listen to active orders.
- **Embedded Arrays**: Menu items are stored directly inside Order documents to solve the N+1 read problem.
- **Geographic Partitioning**: Orders use 'zoneId' (pincode) so delivery partners only see relevant jobs.

## 4. IDENTIFICATION LOGIC
- Restaurant/Salon detection is via 'store.businessType' or heuristic keyword matching in name/description.

## 5. SECURITY RULES
\`\`\`rules
${rulesText}
\`\`\`

## 6. RECENT ARCHITECTURE UPDATES
${overviewText}

## 7. PERFORMANCE STATUS
${auditText}

[USER: PASTE YOUR PROBLEM OR QUESTION HERE]
`.trim();
}
