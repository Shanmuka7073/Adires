
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { FileCode } from 'lucide-react';

const codeText = `
// FILE: src/app/menu/[storeId]/page.tsx
// DYNAMIC QR MENU & ORDERING LOGIC

export default function PublicMenuPage() {
  const { storeId } = useParams();
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');

  // 1. Session ID generation based on Table vs Home
  const sessionId = useMemo(() => {
    const dS = \`\${new Date().getFullYear()}-\${new Date().getMonth() + 1}-\${new Date().getDate()}\`;
    if (tableNumber) return \`table-\${tableNumber}-\${dS}-\${storeId}\`;
    return \`home-\${deviceId}-\${dS}\`;
  }, [tableNumber, storeId]);

  // 2. Real-time Order Listener (Active orders ONLY)
  const ordersQuery = query(collection(firestore, 'orders'), where('sessionId', '==', sessionId), where('isActive', '==', true));
  const { data: placedOrders } = useCollection(ordersQuery);

  const handlePlaceOrder = async () => {
    // Uses server action to batch create the order document
    const res = await addRestaurantOrderItem({ storeId, sessionId, tableNumber, items: cartItems });
  };
}
`;

export default function MenuHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    if (!isLoading && !isAdmin) router.replace('/dashboard');
    if (isLoading || !isAdmin) return null;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2"><FileCode className="h-8 w-8 text-primary" /> Menu System Source Code</CardTitle>
                    <CardDescription>Logic for the dynamic QR ordering system.</CardDescription>
                </CardHeader>
                <CardContent><CodeDisplay codeText={codeText} /></CardContent>
            </Card>
        </div>
    );
}
