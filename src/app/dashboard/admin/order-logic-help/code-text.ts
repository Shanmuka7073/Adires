
'use client';

export const orderLogicCode = [
    {
        path: 'src/app/actions.ts (Atomic Operational Upsert)',
        content: `
/**
 * THE OPERATIONAL INDEX PATTERN
 * 
 * We use an embedded 'items' array.
 * When adding an item, we also store the 'menuItemId' for persistent 
 * link to ingredients and historical reporting.
 */
export async function addRestaurantOrderItem({ storeId, sessionId, item, quantity, ... }) {
  const orderId = \`\${storeId}_\${sessionId}\`;
  const orderDocRef = db.collection('orders').doc(orderId);

  const orderItem: OrderItem = {
    id: uuidv4(),
    orderId,
    productId: \`\${storeId}-\${createSlug(item.name)}\`,
    menuItemId: item.id, // THE STABLE ANALYTICS KEY
    productName: item.name,
    quantity,
    price: item.price,
  };

  await orderDocRef.set({
    id: orderId,
    status: 'Draft',
    isActive: true, // Visible to Kitchen POS
    items: FieldValue.arrayUnion(orderItem),
    totalAmount: FieldValue.increment(item.price * quantity),
    ...metadata
  }, { merge: true });
}
`
    },
    {
        path: 'Reporting Benefits',
        content: `
/**
 * WHY STORE THE ID?
 * 
 * Even if the owner renames "Chicken Curry" to "Grandma's Curry",
 * the 'menuItemId' remains constant.
 * 
 * This allows the Sales Report to:
 * 1. Correctlly sum up historical volume for the same item.
 * 2. Lookup the EXACT ingredient costs assigned to that ID.
 * 3. Calculate "Gross Profit" accurately regardless of display changes.
 */
`
    }
];
