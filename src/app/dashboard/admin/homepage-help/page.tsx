
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';

const codeText = `
// FILE: src/app/page.tsx
// MAIN HOMEPAGE LOGIC: CATEGORIES & SEARCH

export default function LocalBasketHomepage() {
  const { masterProducts, productPrices, stores } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filter products and stores based on search
  const filteredProducts = useMemo(() => searchTerm ? masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : [], [searchTerm, masterProducts]);
  const filteredStores = useMemo(() => searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : [], [searchTerm, stores]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <HomepageHeader onSearchChange={setSearchTerm} />
      <main className="p-4 space-y-8">
        {searchTerm ? (
             <div className="space-y-8">
                {/* Search Results Display */}
            </div>
        ) : (
          <>
            {/* Standard Category Grid Display */}
            {homePageSections.map(section => (
                <section key={section.title}>
                    <h2 className="text-xl font-black">{section.title}</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {section.categories.map(item => <GroceryCategoryCard key={item.name} {...item} />)}
                    </div>
                </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
`;

export default function HomepageHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    if (!isLoading && !isAdmin) router.replace('/dashboard');
    if (isLoading || !isAdmin) return null;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2"><Home className="h-8 w-8 text-primary" /> Homepage Source Code</CardTitle>
                    <CardDescription>Core logic for the central marketplace hub.</CardDescription>
                </CardHeader>
                <CardContent><CodeDisplay codeText={codeText} /></CardContent>
            </Card>
        </div>
    );
}
