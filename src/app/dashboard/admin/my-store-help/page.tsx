
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';

const codeText = `
// FILE: src/app/dashboard/owner/my-store/page.tsx
// STORE MANAGEMENT & VERTICAL SYNC

function ManageStoreView({ store }) {
    // AUTO-REPAIR LOGIC: Ensure businessType matches accountType
    useEffect(() => {
        if (userData?.accountType) {
            const inferredType = userData.accountType === 'restaurant' ? 'restaurant' : 'grocery';
            if (!store.businessType || store.businessType !== inferredType) {
                updateDoc(doc(firestore, 'stores', store.id), { businessType: inferredType });
            }
        }
    }, [store.businessType, userData?.accountType]);

    return (
      <Tabs defaultValue="overview">
        {/* Toggle between Menu Manager (Service) and Checklist (Retail) */}
        {store.businessType === 'grocery' ? (
            <ProductChecklist storeId={store.id} />
        ) : (
            <Link href="/dashboard/owner/menu-manager">Digital Menu Manager</Link>
        )}
      </Tabs>
    )
}
`;

export default function MyStoreHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    if (!isLoading && !isAdmin) router.replace('/dashboard');
    if (isLoading || !isAdmin) return null;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2"><Store className="h-8 w-8 text-primary" /> Store Dashboard Source Code</CardTitle>
                    <CardDescription>Management UI for business owners.</CardDescription>
                </CardHeader>
                <CardContent><CodeDisplay codeText={codeText} /></CardContent>
            </Card>
        </div>
    );
}
