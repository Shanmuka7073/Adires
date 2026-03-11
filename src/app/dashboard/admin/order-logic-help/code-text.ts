
'use client';

export const orderLogicCodeText = [
    {
        path: 'src/app/actions.ts (Restaurant Order Creation)',
        content: `
/**
 * RESTAURANT ORDER LOGIC
 * 
 * Every time a user adds an item, we:
 * 1. Read (getDoc) the existing bill for that table.
 * 2. Update (setDoc/merge) the bill with the new item.
 * 
 * Total Cost: 1 Read + 1 Write per "Add to Bill" action.
 */
export async function addRestaurantOrderItem({
  storeId,
  tableNumber,
  item,
  quantity,
}: { ... }) {
  // 1. READ: Find if table already has an active bill
  const activeOrderQuery = await ordersRef
    .where('storeId', '==', storeId)
    .where('tableNumber', '==', tableNumber)
    .where('status', 'in', ['Pending', 'Processing', 'Billed'])
    .limit(1)
    .get();

  // 2. WRITE: Create or update the document
  await orderRef.set({
    ...orderData,
    items: [...(orderData.items || []), orderItem],
    totalAmount: (orderData.totalAmount || 0) + (orderItem.price * orderItem.quantity),
    status: 'Pending',
  }, { merge: true });
}
`,
    }
];
