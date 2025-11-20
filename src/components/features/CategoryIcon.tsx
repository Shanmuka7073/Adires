
'use client';

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { getProductImage } from "@/lib/data";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { useAppStore } from "@/lib/store";

interface CategoryIconProps {
  category: {
    categoryName: string;
    items: string[];
  };
}

// Helper to create a slug from a category name
const createSlug = (name: string) => {
  return name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-');
}

export default function CategoryIcon({ category }: CategoryIconProps) {
  const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
  const [isLoading, setIsLoading] = useState(true);
  const firstStoreId = useAppStore((state) => state.stores[0]?.id);
  
  useEffect(() => {
    const fetchImage = async () => {
      setIsLoading(true);
      const imageId = `cat-${createSlug(category.categoryName)}`;
      const fetchedImage = await getProductImage(imageId);
      setImage(fetchedImage);
      setIsLoading(false);
    }
    fetchImage();
  }, [category.categoryName]);

  if (isLoading || !firstStoreId) {
    return (
        <div className="flex flex-col items-center gap-2 text-center w-20">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
        </div>
    )
  }

  const categoryLink = `/stores/${firstStoreId}?category=${encodeURIComponent(category.categoryName)}`;

  return (
    <Link href={categoryLink} className="group flex flex-col items-center gap-2 text-center w-20 flex-shrink-0">
      <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-all group-hover:shadow-md group-hover:ring-2 group-hover:ring-primary bg-muted/20">
        <div className="relative w-full h-full">
            <Image 
                src={image.imageUrl}
                alt={category.categoryName}
                data-ai-hint={image.imageHint}
                fill
                className="object-cover transition-transform group-hover:scale-105"
            />
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors truncate w-full">{category.categoryName}</span>
    </Link>
  );
}
