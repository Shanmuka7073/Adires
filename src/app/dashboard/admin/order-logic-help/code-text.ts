
'use client';

export const orderLogicCodeText = [
    {
        path: 'src/app/dashboard/owner/orders/page.tsx (Optimized Active Query)',
        content: `
/**
 * HIGH-PERFORMANCE OPERATION CENTER QUERY
 * 
 * We strictly filter by status at the DATABASE level.
 * This prevents the "N+History" read explosion where the dashboard
 * would waste money reading thousands of old, completed orders.
 */
const activeOrdersQuery = useMemoFirebase(() =>
  firestore && myStore
    ? query(
        collection(firestore, 'orders'),
        where('storeId', '==', myStore.id),
        // DB-LEVEL FILTER: Exclude Completed/Delivered/Cancelled
        where('status', 'in', ['Draft', 'Pending', 'Processing', 'Billed', 'Out for Delivery']),
        orderBy('orderDate', 'desc'),
        limit(50)
      )
    : null,
[firestore, myStore]);
`,
    },
    {
        path: 'src/app/actions.ts (Optimized markSessionAsPaid)',
        content: `
/**
 * TARGETED BATCH UPDATE
 * 
 * Instead of reading the entire session, we only read orders that are 
 * actually ready for payment (status == 'Billed').
 */
export async function markSessionAsPaid(sessionId: string) {
  const snapshot = await db.collection('orders')
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'Billed') // TARGETED READ
      .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'Completed', ... });
  });
  await batch.commit();
}
`,
    }
];
