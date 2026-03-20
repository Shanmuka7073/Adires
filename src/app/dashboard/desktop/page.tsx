'use client';

import { useState, useMemo, useEffect } from 'react';
import { Product, ProductPrice, Store } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { Search } from 'lucide-react';

interface CategoryButtonProps {
  category: { name: string };
  isSelected: boolean;
  onSelectCategory: (name: string) => void;
}

function CategoryButton({ category, isSelected, onSelectCategory }: CategoryButtonProps) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
    const [isImageLoading, setIsImageLoading] = useState(true);

    useEffect(() => {
        const fetchImage = async () => {
            setIsImageLoading(true);
            const imageId = `cat-${category.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
            try {
                const fetchedImage = await getProductImage(imageId);
                setImage(fetchedImage);
            } catch (error) {
                console.error("Failed to fetch image for category:", category.name, error);
                setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/200/200', imageHint: 'placeholder' });
            } finally {
                setIsImageLoading(false);
            }
        };
        fetchImage();
    }, [category.name]);

    return (
        <button
            onClick={() => onSelectCategory(category.name)}
            className={cn(
                "flex items-center w-full text-left gap-3 py-2 px-3 rounded-lg transition-all duration-200",
                isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
            )}
        >
            {isImageLoading ? (
                 <Skeleton className="w-8 h-8 rounded-full" />
            ) : (
                <Image
                    src={image.imageUrl}
                    alt={category.name}
                    width={32}
                    height={32}
                    data-ai-hint={image.imageHint}
                    className="w-8 h-8 object-cover rounded-full"
                />
            )}
            <span className="text-sm truncate">
              {category.name}
            </span>
        </button>
    );
}

export default function DesktopDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  
  const { firestore } = useFirebase();
  const { masterProducts, productPrices, fetchProductPrices, isInitialized, loading: appLoading } = useAppStore();
  
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    const categorySet = new Set<string>();
    masterProducts.forEach(p => {
        if (p.category) {
            categorySet.add(p.category);
        }
    });
    return Array.from(categorySet).map(name => ({ name }));
  }, [masterProducts]);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (firestore && masterProducts.length > 0) {
      const productNames = masterProducts.map(p => p.name);
      fetchProductPrices(firestore, productNames);
    }
  }, [firestore, masterProducts, fetchProductPrices]);

  useEffect(() => {
    if (categoryFromUrl && categories.some(c => c.name === categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
    } 
    else if (!selectedCategory && categories.length > 0) {
      // Default to the first category if none is selected in the URL
      const firstCategory = categories[0].name;
      setSelectedCategory(firstCategory);
      router.replace(`${pathname}?category=${firstCategory}`, { scroll: false });
    }
  }, [categories, selectedCategory, categoryFromUrl, router, pathname]);

  const handleSelectCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchTerm(''); // Clear search when a category is clicked
    router.push(`${pathname}?category=${categoryName}`, { scroll: false });
  };

  const filteredProducts = useMemo(() => {
    let productsToFilter = masterProducts;
    
    if (searchTerm) {
      return productsToFilter.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory) {
      return productsToFilter.filter(p => p.category === selectedCategory);
    }
    
    return [];
  }, [masterProducts, selectedCategory, searchTerm]);

  const isLoading = appLoading || !isInitialized;

  return (
    <div className="flex w-full h-screen bg-[#fafafa]">
      <aside className="w-64 bg-background h-full overflow-y-auto py-4 border-r sticky top-0">
        <ScrollArea className="h-full px-4">
            <h2 className="text-lg font-semibold px-3 mb-4">Categories</h2>
            <div className="flex flex-col items-start space-y-2">
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : (
                    categories.map((cat) => (
                        <CategoryButton 
                            key={cat.name}
                            category={cat}
                            isSelected={cat.name === selectedCategory && !searchTerm}
                            onSelectCategory={handleSelectCategory}
                        />
                    ))
                )}
            </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#fafafa]/80 backdrop-blur-sm py-4 z-10">
            <div>
                <h1 className="text-3xl font-bold font-headline">{searchTerm ? "Search Results" : selectedCategory || 'Products'}</h1>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? `Found ${filteredProducts.length} products matching "${searchTerm}"` : `Showing ${filteredProducts.length} products in this category.`}
                </p>
            </div>
            <div className="w-full max-w-sm relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const priceData = productPrices[product.name.toLowerCase()];
                return <ProductCard key={product.id} product={product} priceData={priceData} />;
              })
            ) : (
              <p className="text-muted-foreground col-span-full text-center py-10">No products found.</p>
            )}
          </div>
      </main>
    </div>
  );
}
