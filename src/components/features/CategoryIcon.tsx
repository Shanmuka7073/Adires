
'use client';

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { getProductImage } from "@/lib/data";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

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

  if (isLoading) {
    return (
        <div className="flex flex-col items-center gap-2 text-center w-full">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-12" />
        </div>
    )
  }

  return (
    <>
      <div className={cn("relative rounded-full p-1", "ring-2 ring-transparent")}>
        <div className="relative rounded-full object-cover w-14 h-14 overflow-hidden bg-muted">
            <Image 
                src={image.imageUrl}
                alt={category.categoryName}
                data-ai-hint={image.imageHint}
                fill
                className="object-cover"
            />
        </div>
      </div>
      <span className="text-xs font-medium w-full truncate">{category.categoryName}</span>
    </>
  );
}
