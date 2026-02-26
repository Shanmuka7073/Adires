
'use client';

export const deliveriesCodeText = [
    {
        path: 'src/app/dashboard/delivery/deliveries/page.tsx (Partial: Queries)',
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
];
