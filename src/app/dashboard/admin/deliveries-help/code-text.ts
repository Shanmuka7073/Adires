
'use client';

export const deliveriesCodeText = [
    {
        path: 'src/app/dashboard/delivery/deliveries/page.tsx (Partitioned Query)',
        content: `
  /**
   * PARTITIONED AVAILABLE DELIVERIES QUERY
   * 
   * CRITICAL: We filter by 'zoneId' to ensure this query remains performant
   * as the platform scales. Without this, Firestore would scan every
   * pending order globally.
   */
  const availableDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !partnerData?.zoneId) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', '==', 'Pending'),
        where('zoneId', '==', partnerData.zoneId) // Geographic Partitioning
    );
  }, [firestore, partnerData?.zoneId]);
  
  // Other standard queries
  const myActiveDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', '==', 'Out for Delivery'),
        where('deliveryPartnerId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
`,
    },
    {
        path: 'src/app/dashboard/delivery/deliveries/page.tsx (useCollection Hooks)',
        content: `
  /**
   * REAL-TIME DATA SYNC WITH useCollection
   * 
   * These hooks automatically manage listeners, clean up on unmount, 
   * and update the UI instantly when data changes in Firestore.
   */

  // 1. Listen for active deliveries assigned to THIS partner
  const { 
    data: myActiveDeliveries, 
    isLoading: activeDeliveriesLoading 
  } = useCollection<Order>(myActiveDeliveriesQuery);

  // 2. Listen for partitioned available jobs in the partner's zone
  const { 
    data: availableDeliveries, 
    isLoading: availableDeliveriesLoading 
  } = useCollection<Order>(availableDeliveriesQuery);

  // 3. Partner Profile Reference
  const partnerDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'deliveryPartners', user.uid);
  }, [firestore, user?.uid]);
`,
    }
];
