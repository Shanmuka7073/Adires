
'use client';

export const orderLogicCode = [
    {
        path: 'src/app/actions.ts (Atomic Operational Upsert)',
        content: `
/**
 * THE OPERATIONAL INDEX PATTERN
 * This pattern ensures that active orders are indexed for the POS
 * without loading historical data.
 */
export async function addRestaurantOrderItem({ storeId, sessionId, item, quantity, ... }) {
  const orderId = \`\${storeId}_\${sessionId}\`;
  const orderDocRef = db.collection('orders').doc(orderId);

  // We set 'isActive: true'. This is the core field the POS filters by.
  await orderDocRef.set({
    id: orderId,
    storeId,
    status: 'Draft',
    isActive: true, // Operational Index Flag
    orderDate: FieldValue.serverTimestamp(),
    items: FieldValue.arrayUnion({ ...item, quantity }),
    totalAmount: FieldValue.increment(item.price * quantity),
    ...customerMeta
  }, { merge: true });
}
`
    },
    {
        path: 'src/app/dashboard/owner/orders/page.tsx (POS Operational Listener)',
        content: `
/**
 * THE OPERATIONAL POS QUERY
 * Only reads documents where isActive is true. 
 * This prevents reading the entire order history.
 */
const activeOrdersQuery = query(
    collection(firestore, 'orders'),
    where('storeId', '==', myStore.id),
    where('isActive', '==', true), // THE PERFORMANCE FIX
    orderBy('orderDate', 'desc'),
    limit(50)
);

// This ensures that even if you have 10,000 historical orders,
// the Kitchen screen only 'pays' for the 5-10 active tables.
`
    },
    {
        path: 'src/app/actions.ts (Lifecycle Closure)',
        content: `
/**
 * CLOSING THE READ CYCLE
 * When a customer pays, we mark isActive: false.
 */
export async function markSessionAsPaid(sessionId: string) {
  const snapshot = await db.collection('orders')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'Billed')
      .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { 
        status: 'Completed', 
        isActive: false // Removes from POS Operational Index
    });
  });
  await batch.commit();
}
`
    }
];
