
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import React, { useState } from 'react';

// This audit text is generated based on the code provided previously.
const auditText = `
## Firestore Performance Audit

This report analyzes every Firestore read and write operation in the application, identifies performance bottlenecks, and quantifies potential costs.

---

### 1. FIRESTORE READ AUDIT

**1.1. App Initialization (Zustand)**
- **Path**: \`/stores\`, \`/voiceAliasGroups\`, \`/voiceCommands\`
- **Method**: \`getDocs(collection())\` inside \`fetchInitialData\`.
- **Trigger**: App cold start (\`useInitializeApp\` hook).
- **Role**: All roles (Customer, Owner, Admin).
- **Type**: One-time per session.
- **Reads**: **1 (stores) + N (menus) + 1 (aliases) + 1 (commands)**. Critically, the menu query runs for *every* store, leading to an **N+3** read explosion on startup, where N is the number of stores.

**1.2. Product Price Fetching (Zustand)**
- **Path**: \`/productPrices\`
- **Method**: \`getDocs(query(where('productName', 'in', ...)))\` in batches of 30.
- **Trigger**: After app initialization completes.
- **Role**: All roles.
- **Type**: One-time per session.
- **Reads**: **M / 30** (M = number of master products). This is efficient.

**1.3. User Profile (`useDoc`)**
- **Path**: \`/users/{userId}\`
- **Method**: \`onSnapshot(doc())\`
- **Trigger**: Any page that uses \`useFirebase\` and has a logged-in user (e.g., Checkout, Profile).
- **Role**: All logged-in roles.
- **Type**: Real-time.
- **Reads**: 1 per session, plus 1 for each document update. Low cost.

**1.4. Store Owner's Store (`useCollection`)**
- **Path**: \`/stores\`
- **Method**: \`onSnapshot(query(where('ownerId', '==', ...)))\`
- **Trigger**: \`MyStorePage\` load.
- **Role**: Store Owner.
- **Type**: Real-time.
- **Reads**: 1 (initial) + 1 per update. Low cost.

**1.5. Store Orders Page (`useCollection`)**
- **Path**: \`/orders\`
- **Method**: \`onSnapshot(query(where('storeId', '==', ...)))\`
- **Trigger**: \`StoreOrdersPage\` load.
- **Role**: Store Owner, Admin.
- **Type**: Real-time.
- **Reads**: **K (initial)** (K = orders for that store) + 1 per update. **HIGH RISK**.

**1.6. Delivery Dashboard (`useCollection`)**
- **Path**: \`/orders\` (two separate listeners)
- **Method**: \`onSnapshot(query(where('status', '==', 'Out for Delivery')))\` and \`onSnapshot(query(where('status', '==', 'Pending')))\`.
- **Trigger**: \`DeliveriesPage\` load.
- **Role**: Delivery Partner.
- **Type**: Real-time.
- **Reads**: **(A + B)** (A = active deliveries, B = pending orders) + updates. **HIGH RISK**.

**1.7. QR Menu Page (`useDoc`, \`useCollection\`)**
- **Path**: \`/stores/{storeId}\`, \`/stores/{storeId}/menus\`
- **Method**: \`onSnapshot(doc())\` and \`onSnapshot(collection())\`.
- **Trigger**: Page load by customer scanning QR code.
- **Role**: Customer (Anonymous).
- **Type**: Real-time.
- **Reads**: 1 (store) + 1 (menu) = 2 reads per page load. Low cost.

---

### 2. FIRESTORE WRITE AUDIT

| Operation                | Path                                   | Method      | Role                 | Frequency                | Hidden Reads |
| ------------------------ | -------------------------------------- | ----------- | -------------------- | ------------------------ | ------------ |
| Add Menu Item to Bill    | \`/orders/{orderId}\`                  | \`setDoc\`, \`updateDoc\` | Customer (Anonymous) | High (per item added)    | **Yes (getDoc)** |
| Close Bill               | \`/orders/{orderId}\`                  | \`setDoc\`      | Customer (Anonymous) | Medium (per table)       | No           |
| Confirm Payment          | \`/orders/{sessionId}\`                | \`updateDoc\`   | Restaurant POS       | Medium (per table)       | **Yes (getDocs)** |
| Update Order Status      | \`/orders/{orderId}\`                  | \`updateDoc\`   | Restaurant POS       | Medium (per order)       | No           |
| Accept Delivery Job      | \`/orders/{orderId}\`                  | \`updateDoc\`   | Delivery Partner     | Low                      | No           |
| Mark Delivered           | \`/orders/{orderId}\`, \`/deliveryPartners/{partnerId}\` | \`writeBatch\`  | Delivery Partner     | Medium                   | **Yes (increment)** |

---

### 3. ZUSTAND + FIRESTORE ANALYSIS

- **Initialization Reads**: The \`fetchInitialData\` function in \`useAppStore\` is the biggest source of reads. It fetches **ALL stores, ALL their menus, ALL voice aliases, and ALL voice commands** on every single app startup for every user.
- **Duplicate Reads**: If 50 stores exist, the app performs **53 reads on startup for every user**, even if they only interact with one store. This data is then stored globally in Zustand.
- **Unnecessary Global Data**:
  - \`allMenus\`: **Should be lazy-loaded**. A customer only needs the menu for the specific restaurant they are viewing. Loading all menus for all stores is extremely wasteful.
  - \`stores\`: **Critical**, but can be optimized. A list of store names/locations is needed, but full details can be lazy-loaded.

---

### 4. REAL-TIME LISTENER COST ANALYSIS

**Listener 1: Store Orders Page (\`useCollection\`)**
- **Collection**: \`/orders\`
- **Documents Watched**: Potentially all orders for a store for all time.
- **Subscription**: On page load.
- **Unsubscribe**: On page unmount.
- **Worst-Case Reads**: If a restaurant has 500 orders/day, and 10 POS terminals are open, this is **5,000 initial reads per day**. Every status update to any order triggers a read for all 10 terminals (**+10 reads**). This is unsustainable.
- **Recommendation**: **MUST be replaced**. Use a query with a date range (e.g., today's orders) and status filters (\`where('status', 'in', ['Pending', 'Billed'])\`).

**Listener 2: Delivery Dashboard (\`useCollection\`)**
- **Collection**: \`/orders\` (x2)
- **Documents Watched**: All pending orders and all "Out for Delivery" orders across the entire platform.
- **Subscription**: On page load.
- **Unsubscribe**: On page unmount.
- **Worst-Case Reads**: If 100 orders are pending platform-wide and 50 delivery partners open the app, this is **5,000 reads instantly**. This does not scale.
- **Recommendation**: **MUST be replaced**. This should be a one-time \`getDocs\` query, possibly with a "Refresh" button. Real-time updates are not critical for a list of available jobs.

---

### 5. ROLE-BASED OVERFETCHING

- **Customer**: Overfetches **ALL store menus** on startup.
- **Store Owner / Admin**: Overfetches **ALL store menus** on startup.
- **Delivery Partner**: Overfetches **ALL pending orders** via a real-time listener, even if they are geographically irrelevant. This is a major cost and performance issue.

There are no major least-privilege *security* violations, but there are massive *data access* violations (overfetching) that directly lead to high costs.

---

### 6. SESSION & BILLING LOGIC READS

- **Read Amplification**: When 4 users at a table add 1 item each, the logic performs **4 \`getDoc\` reads** (one for each \`addRestaurantOrderItem\` call) to check if the order document exists, followed by **4 \`updateDoc\` writes**.
- **Redundant Reads**: This is inefficient. The first user's action should create the document, and subsequent actions on the same bill should only be \`updateDoc\` calls with \`arrayUnion\`.
- **Reads Per Table Per Hour**: Assuming a table of 4 orders 10 items over an hour, this would be **~10 reads and ~10 writes**. This part of the system is reasonably efficient. The main issue is the initial \`getDoc\` check on every single item addition.

---

### 7. COLD START vs. WARM START

- **Cold Start (Biggest Read Explosion)**: A first-time user triggers \`fetchInitialData\`, causing **N+3 reads** (N=stores). If there are 100 stores, this is **103 reads just to start the app**. This is the primary bottleneck.
- **Warm Start (Zustand Hydration)**: A returning user hydrates the state from local storage. No initial Firestore reads happen, making it very fast and cheap. However, the background refresh logic in \`ClientRoot\` still re-triggers the expensive N+3 read fetch.
- **Navigation**: Navigating between pages is cheap because all data is already in the Zustand global store.

---

### 8. FINAL SUMMARY

- **Reads per Customer Session (Cold)**: **~105+** (103 for init + 2 for menu).
- **Reads per POS Session (Cold)**: **~103 + K** (K=all orders for that store). **EXTREMELY DANGEROUS.**
- **Estimated Reads/Day (1 Restaurant, 10 POS, 500 orders)**: Initial load: (103 reads * 10 terminals) + Real-time listener: (500 initial reads * 10 terminals) = **~6,030 reads/day MINIMUM**, before any updates.
- **Top 5 Most Expensive Reads**:
  1. \`fetchInitialData\` -> Fetching **all store menus** (N reads).
  2. Store Owner Orders Listener -> Watching all orders for a store (K reads).
  3. Delivery Partner "Pending" Listener -> Watching all pending orders (B reads).
  4. Delivery Partner "Active" Listener -> Watching all active deliveries (A reads).
  5. \`fetchInitialData\` -> Fetching all stores (N reads).
- **Reads to Remove Immediately**:
  - The fetch of **all menus** inside \`fetchInitialData\` must be removed.
  - The \`storeId\` and \`sessionId\` queries on the \`/orders\` collection for the POS screen must be converted to one-time reads (\`getDocs\`) with stricter filters.
`;

function AuditDisplay({ auditText }: { auditText: string }) {
    // This simple formatter will turn markdown-like headers and lists into HTML.
    const formatContent = (text: string) => {
        return text
            .split('\\n')
            .map((line, index) => {
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-xl font-semibold mt-6 mb-2">{line.substring(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{line.substring(3)}</h2>;
                }
                 if (line.startsWith('- **')) {
                    const boldPart = line.match(/- \*\*(.*?)\*\*/);
                    const restOfLine = line.substring(boldPart ? boldPart[0].length : 2);
                    return <p key={index} className="mt-2"><strong className="font-semibold">{boldPart ? boldPart[1] : ''}</strong>{restOfLine}</p>;
                }
                 if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
                }
                if (line.trim() === '---') {
                    return <hr key={index} className="my-6 border-dashed" />;
                }
                if (line.startsWith('|')) {
                     const isHeader = line.includes('---');
                    const cells = line.split('|').map(c => c.trim()).slice(1, -1);
                     if (isHeader) return null;
                    return (
                        <tr key={index} className="border-b">
                            {cells.map((cell, i) => <td key={i} className="p-2 align-top">{cell}</td>)}
                        </tr>
                    );
                }
                 if (line.trim() === '') {
                    return <br key={index} />;
                }
                return <p key={index}>{line}</p>;
            })
    };

    return (
        <div className="prose prose-sm sm:prose-base max-w-none">
            {formatContent(auditText)}
        </div>
    );
}


export default function PerformanceAuditPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

     if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                       <BarChart3 className="h-8 w-8 text-primary" />
                        Firebase Performance Audit
                    </CardTitle>
                    <CardDescription>
                        A detailed breakdown of Firestore read/write operations and potential performance bottlenecks.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <AuditDisplay auditText={auditText} />
                </CardContent>
            </Card>
        </div>
    );
}
