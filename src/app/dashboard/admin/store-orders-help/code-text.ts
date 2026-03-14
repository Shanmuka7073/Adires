
'use client';

export const storeOrdersCodeText = [
    {
        path: 'src/app/dashboard/owner/orders/page.tsx (Optimized Active Query)',
        content: `
/**
 * OPTIMIZED OPERATION CENTER QUERY
 * 
 * To fix the "reading all orders" issue, we strictly filter by
 * active statuses and sort by the latest first.
 */
const activeOrdersQuery = useMemoFirebase(() =>
  firestore && myStore
    ? query(
        collection(firestore, 'orders'),
        where('storeId', '==', myStore.id),
        // FIXED: Only load active states. Completed/Cancelled are moved to History.
        where('status', 'in', ['Pending', 'Processing', 'Billed', 'Out for Delivery', 'Draft']),
        orderBy('orderDate', 'desc')
      )
    : null,
[firestore, myStore]);

/**
 * HISTORICAL DATA RECOVERY
 * 
 * Historical data is loaded only on-demand using a date picker, 
 * preventing startup read explosions.
 */
const fetchHistory = async () => {
    const hQuery = query(
        collection(firestore, 'orders'),
        where('storeId', '==', myStore.id),
        where('orderDate', '>=', Timestamp.fromDate(start)),
        where('orderDate', '<=', Timestamp.fromDate(end)),
        orderBy('orderDate', 'desc')
    );
    // ... exec query
}
`
    }
];
