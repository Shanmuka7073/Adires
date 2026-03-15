
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PackageSearch, Code2, Database, Smartphone } from 'lucide-react';

const orderLogicCode = [
    {
        path: 'src/app/actions.ts (Server-Side Upsert)',
        content: `
/**
 * THE ATOMIC UPSERT PATTERN (0 Reads, 1 Write)
 * This handles adding items to a bill. It automatically creates
 * the order if it doesn't exist, or adds to the items array if it does.
 */
export async function addRestaurantOrderItem({ storeId, tableNumber, sessionId, item, quantity, ...customerData }) {
  const orderId = \`\${storeId}_\${sessionId}\`;
  const orderDocRef = db.collection('orders').doc(orderId);

  const orderItem = {
    id: uuidv4(),
    productName: item.name,
    quantity,
    price: item.price,
    // ... item meta
  };

  // set() with {merge: true} + FieldValue operations = HIGH PERFORMANCE
  await orderDocRef.set({
    id: orderId,
    storeId,
    tableNumber: String(tableNumber),
    sessionId,
    status: 'Draft', // Visible to kitchen as "ordering"
    orderDate: FieldValue.serverTimestamp(),
    items: FieldValue.arrayUnion(orderItem),
    totalAmount: FieldValue.increment(item.price * quantity),
    ...customerData
  }, { merge: true });
}
`
    },
    {
        path: 'src/app/dashboard/owner/orders/page.tsx (POS Listener)',
        content: `
/**
 * THE KITCHEN MONITOR
 * A real-time listener that only cares about active operations.
 */
const activeOrdersQuery = query(
    collection(firestore, 'orders'),
    where('storeId', '==', myStore.id),
    orderBy('orderDate', 'desc'),
    limit(50)
);

// We filter statuses in JavaScript to avoid index-building delays
// and ensure 100% reliability for new orders.
const filtered = allOrders.filter(o => 
    ['Draft', 'Pending', 'Processing', 'Billed', 'Out for Delivery'].includes(o.status)
);
`
    },
    {
        path: 'src/app/menu/[storeId]/page.tsx (Customer Action)',
        content: `
/**
 * THE CONFIRMATION TRIGGER
 * When a customer clicks "Confirm Order" or "Request Bill".
 */
const closeBill = async () => {
  // Transitions status from 'Draft' -> 'Processing'
  // Or 'Processing' -> 'Billed'
  await confirmOrderSession(order.id);
  toast({ title: 'Kitchen Notified!' });
};
`
    }
];

export default function OrderLogicHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

     if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <PackageSearch className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">Order Logic Source Code</CardTitle>
                            <CardDescription>
                                This is the complete technical implementation of how orders move from a customer's phone to the Kitchen Operation Center.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <Accordion type="single" collapsible className="w-full" defaultValue={orderLogicCode[0].path}>
                        {orderLogicCode.map((file) => (
                             <AccordionItem value={file.path} key={file.path}>
                                <AccordionTrigger className="font-mono text-sm">
                                    <div className="flex items-center gap-2">
                                        <Code2 className="h-4 w-4 opacity-40" />
                                        {file.path}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <CodeDisplay codeText={file.content} />
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                   </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
    