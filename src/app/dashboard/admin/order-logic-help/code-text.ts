
'use client';

export const orderLogicCodeText = [
    {
        path: 'src/app/checkout/page.tsx (Grocery Order Submission)',
        content: `
  /**
   * STANDARD GROCERY ORDER CREATION
   * 
   * This logic runs on the client-side when a user submits the checkout form.
   */
  const onSubmit = (data: CheckoutFormValues) => {
    if (!firestore || !user) return;
    
    startPlaceOrderTransition(async () => {
        const totalAmount = cartTotal + DELIVERY_FEE;
        const orderDocRef = doc(collection(firestore, 'orders'));

        const orderData = {
            id: orderDocRef.id,
            userId: user.uid,
            storeId: activeStoreId,
            customerName: data.name,
            deliveryAddress: data.deliveryAddress,
            deliveryLat: deliveryCoords?.lat || 0,
            deliveryLng: deliveryCoords?.lng || 0,
            phone: data.phone,
            email: user.email,
            orderDate: serverTimestamp(),
            status: 'Pending' as 'Pending',
            totalAmount,
            // Map cart items to the denormalized OrderItem structure
            items: cartItems.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                variantSku: item.variant.sku,
                variantWeight: item.variant.weight,
                quantity: item.quantity,
                price: item.variant.price,
            })),
        };

        try {
            // Write the order to the top-level 'orders' collection
            await setDoc(orderDocRef, orderData);
            
            clearCart();
            router.push(\`/order-confirmation?orderId=\${orderDocRef.id}\`);
        } catch (e) {
            // Contextual error handling for security rules
            const permissionError = new FirestorePermissionError({
                path: orderDocRef.path,
                operation: 'create',
                requestResourceData: orderData
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };
`,
    },
    {
        path: 'src/app/actions.ts (Restaurant Table Order)',
        content: `
/**
 * RESTAURANT TABLE ORDER CREATION (Server Action)
 * 
 * This logic handles adding items to a table's bill. It uses 
 * an ID based on storeId + sessionId to aggregate items.
 */
export async function addRestaurantOrderItem({
  storeId,
  sessionId,
  tableNumber,
  item,
  quantity,
}: { ... }) {
  try {
    const { db } = await getAdminServices();
    const orderId = \`\${storeId}_\${sessionId}\`;
    const orderRef = db.collection('orders').doc(orderId);

    const orderItem: OrderItem = {
      id: uuidv4(),
      orderId,
      productName: item.name,
      quantity,
      price: item.price,
      // Snapshots recipe costs for profit analysis
      recipeSnapshot: recipeSnapshotData, 
    };

    const doc = await orderRef.get();

    if (doc.exists) {
      // If a bill exists for this table today, append the new item
      await orderRef.update({
        items: FieldValue.arrayUnion(orderItem),
        totalAmount: FieldValue.increment(orderItem.price * orderItem.quantity),
        updatedAt: FieldValue.serverTimestamp(),
        status: 'Pending',
      });
    } else {
      // Otherwise, start a new bill (session)
      const newOrder: Partial<Order> = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber,
        userId: 'guest',
        totalAmount: orderItem.price * orderItem.quantity,
        status: 'Pending',
        orderDate: Timestamp.now(),
        items: [orderItem],
      };
      await orderRef.set(newOrder);
    }

    return { success: true };
  } catch (error: any) {
    console.error("addRestaurantOrderItem failed:", error);
    return { success: false, error: error.message };
  }
}
`,
    }
];
