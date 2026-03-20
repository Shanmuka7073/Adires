
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { FileCode } from 'lucide-react';

const codeText = `
// FILE: src/app/dashboard/admin/page.tsx
// ADMIN HUB COMPONENT CODE

export default function AdminDashboardPage() {
  const { users, stores, orders } = useCollection(...);

  const stats = useMemo(() => ({
    totalUsers: users?.length ?? 0,
    totalStores: stores?.length ?? 0,
    totalOrdersDelivered: orders?.length ?? 0,
  }), [users, stores, orders]);

  return (
    <div className="container mx-auto py-10 space-y-16">
      {/* Category-based Action Cards */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black">System & Operations</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <ActionCard title="Status" href="/admin/status" icon={Server} />
          {/* ... */}
        </div>
      </section>
    </div>
  );
}
`;

export default function DashboardHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    if (!isLoading && !isAdmin) router.replace('/dashboard');
    if (isLoading || !isAdmin) return null;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2"><FileCode className="h-8 w-8 text-primary" /> Admin Hub Source Code</CardTitle>
                    <CardDescription>Source code for the admin control center.</CardDescription>
                </CardHeader>
                <CardContent><CodeDisplay codeText={codeText} /></CardContent>
            </Card>
        </div>
    );
}
