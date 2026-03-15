
'use client';

export const orderLogicCodeText = [
    {
        path: 'src/app/actions.ts (Restaurant Order Creation)',
        content: `
/**
 * HIGH-PERFORMANCE RESTAURANT ORDER ARCHITECTURE
 * 
 * 1. DETERMINISTIC IDs:
 * We use orderId = storeId + "_" + sessionId. This allows multiple
 * customers to contribute to the same bill without any 'get' queries.
 * 
 * 2. ATOMIC UPSERTS:
 * We use setDoc(ref, ..., { merge: true }) with FieldValue.arrayUnion 
 * and FieldValue.increment. This performs 1 write and 0 reads.
 * 
 * 3. FIELD MAPPING:
 * We explicitly write 'storeId', 'tableNumber' (as string), and 'status' 
 * fields to ensure the POS Dashboard query picks it up instantly.
 */
export async function addRestaurantOrderItem({
  storeId,
  tableNumber,
  sessionId,
  item,
  quantity,
}) {
  const orderId = \`\${storeId}_\${sessionId}\`;
  const orderRef = db.collection('orders').doc(orderId);

  // 0 READS, 1 WRITE
  await orderRef.set({
    id: orderId,
    storeId: storeId, 
    tableNumber: tableNumber ? String(tableNumber) : null,
    status: 'Draft',
    orderDate: FieldValue.serverTimestamp(),
    items: FieldValue.arrayUnion(orderItem),
    totalAmount: FieldValue.increment(item.price * quantity),
  }, { merge: true });
}
`,
    }
];
