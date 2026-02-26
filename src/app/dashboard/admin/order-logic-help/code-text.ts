
'use client';

export const orderLogicCodeText = [
    {
        path: 'src/app/checkout/page.tsx (Partitioned Order Logic)',
        content: `
  /**
   * PARTITIONED GROCERY ORDER CREATION
   * 
   * Every grocery order now includes a 'zoneId' derived from the pincode.
   * This is critical for localizing the "Available Jobs" query for partners.
   */
  const extractZoneId = (address: string) => {
    const pincodeMatch = address.match(/\\b\\d{6}\\b/);
    return pincodeMatch ? \`zone-\${pincodeMatch[0]}\` : 'zone-default';
  };

  const onSubmit = (data: CheckoutFormValues) => {
    startPlaceOrderTransition(async () => {
        const orderDocRef = doc(collection(firestore, 'orders'));

        const orderData = {
            id: orderDocRef.id,
            userId: user.uid,
            storeId: activeStoreId,
            deliveryAddress: data.deliveryAddress,
            // ... standard fields ...
            zoneId: extractZoneId(data.deliveryAddress), // Added Geographic Partition
            status: 'Pending',
            totalAmount: cartTotal + DELIVERY_FEE,
            items: cartItems.map(item => ({ ... })),
        };

        try {
            await setDoc(orderDocRef, orderData);
            clearCart();
            router.push(\`/order-confirmation?orderId=\${orderDocRef.id}\ house\`);
        } catch (e) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ ... }));
        }
    });
  };
`,
    }
];
