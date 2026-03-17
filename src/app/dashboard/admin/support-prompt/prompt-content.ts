
'use client';

import { rulesText } from '../security-rules/rules-text';
import { overviewText } from '../app-overview/overview-text';
import { auditText } from '../performance-audit/audit-text';

export function generateSupportPrompt() {
  return `
# APPLICATION CONTEXT FOR AI SUPPORT
Role: Senior Firebase & Next.js Developer
App Name: LocalBasket

## 1. TECH STACK
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS, ShadCN
- State: Zustand (Persisted)
- Backend: Firebase Client SDK ONLY

## 2. OPTIMIZED DATA STRATEGY (CRITICAL)
The platform uses "Operational Indexing" to protect the Firestore budget:
- **isActive: true**: Used in /orders. dashboards only listen to active orders.
- **Embedded Arrays**: Menu items are stored directly inside Order documents to solve the N+1 read problem.
- **Geographic Partitioning**: orders use 'zoneId' (pincode) so delivery partners only see relevant jobs.

## 3. IDENTIFICATION LOGIC
- Restaurant/Salon detection is via 'store.businessType' or heuristic keyword matching in name/description.

## 4. SECURITY RULES
\`\`\`rules
${rulesText}
\`\`\`

## 5. RECENT ARCHITECTURE UPDATES
${overviewText}

## 6. PERFORMANCE STATUS
${auditText}

[USER: PASTE YOUR PROBLEM OR QUESTION HERE]
`.trim();
}
