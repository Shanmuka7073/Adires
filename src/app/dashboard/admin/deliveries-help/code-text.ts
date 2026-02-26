
'use client';

export const deliveriesCodeText = [
    {
        path: 'src/app/dashboard/delivery/deliveries/page.tsx (Query Definitions)',
        content: `
  // Query 1: Get orders assigned to the current delivery partner.
  const myActiveDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', '==', 'Out for Delivery'),
        where('deliveryPartnerId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
  
  // Query 2: Get orders that are ready for pickup (Pending status, no partner yet).
  const availableDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', '==', 'Pending')
    );
  }, [firestore]);


  // Query 3: Get completed orders for the earnings history.
  const completedDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'Delivered'),
      where('deliveryPartnerId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
  
  // Partner Profile Reference
  const partnerDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'deliveryPartners', user.uid);
  }, [firestore, user?.uid]);

  // Payout History Query
  const payoutsQuery = useMemoFirebase(() => {
    if (!firestore || !partnerId) return null;
    return query(
        collection(firestore, \`deliveryPartners/\${partnerId}/payouts\`),
        orderBy('requestDate', 'desc')
    );
  }, [firestore, partnerId]);
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

  // 2. Listen for all available jobs platform-wide
  const { 
    data: availableDeliveries, 
    isLoading: availableDeliveriesLoading 
  } = useCollection<Order>(availableDeliveriesQuery);

  // 3. Listen for all completed deliveries for the earnings list
  const { 
    data: completedDeliveries, 
    isLoading: completedDeliveriesLoading 
  } = useCollection<Order>(completedDeliveriesQuery);

  // 4. Listen for payout transaction history
  const { 
    data: payouts, 
    isLoading: payoutsLoading 
  } = useCollection<Payout>(payoutsQuery);
`,
    }
];
