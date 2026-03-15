
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PackageSearch, Code2, Info, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const orderLogicCode = [
    {
        path: 'src/app/actions.ts (Atomic Embedded Update)',
        content: `
/**
 * THE EMBEDDED ARRAY PATTERN (Option B)
 * 
 * We store items directly inside the Order document.
 * This allows the Kitchen POS to get the full bill in ONE read.
 */
export async function addRestaurantOrderItem({ storeId, tableNumber, sessionId, item, quantity, ... }) {
  const orderId = \`\${storeId}_\${sessionId}\`;
  const orderDocRef = db.collection('orders').doc(orderId);

  // We use FieldValue.arrayUnion to add items atomically without reading first.
  await orderDocRef.set({
    id: orderId,
    status: 'Draft',
    isActive: true, // Used for the POS Operational Index
    items: FieldValue.arrayUnion({
        id: uuidv4(),
        productName: item.name,
        quantity,
        price: item.price
    }),
    totalAmount: FieldValue.increment(item.price * quantity),
  }, { merge: true });
}
`
    },
    {
        path: 'src/app/dashboard/owner/orders/page.tsx (Single-Read Monitor)',
        content: `
/**
 * THE HIGH-PERFORMANCE LISTENER
 * 
 * Because items are embedded, this query returns the bill
 * metadata AND the item list in a single round-trip.
 */
const activeOrdersQuery = query(
    collection(firestore, 'orders'),
    where('storeId', '==', myStore.id),
    where('isActive', '==', true) // Filter for operational efficiency
);

// results.forEach(doc => {
//    const items = doc.data().items; // No extra reads needed!
// });
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
                            <CardTitle className="text-3xl font-headline">Order Architecture: Option B</CardTitle>
                            <CardDescription>
                                Analysis of our embedded item strategy used to minimize Firestore read costs.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert className="bg-primary/5 border-primary/20">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-bold">Why Embedded Arrays?</AlertTitle>
                        <AlertDescription>
                            We chose to embed items instead of using subcollections to solve the <strong>N+1 Read Problem</strong>. In a busy restaurant, subcollections would require hundreds of additional reads per minute just to show the table cards. Our current method keeps read costs constant at 1 read per table.
                        </AlertDescription>
                    </Alert>

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
