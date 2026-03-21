'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store, Menu } from "@/lib/types";

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Dynamic Manifest API (Standalone Enforcement)
 * Generates a store-specific manifest with a localized scope.
 * This prevents the main Grozo app from capturing restaurant-specific links.
 */
export async function GET(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;

  if (!storeId) {
    return new NextResponse("Store ID is required", { status: 400 });
  }

  try {
    const { db } = await getAdminServices();
    const storeDoc = await db.collection("stores").doc(storeId).get();

    if (!storeDoc.exists) {
      return new NextResponse("Store not found", { status: 404 });
    }

    const store = storeDoc.data() as Store;
    
    // Fetch menu to get theme color
    const menuSnap = await db.collection("stores").doc(storeId).collection("menus").limit(1).get();
    const menu = menuSnap.docs[0]?.data() as Menu | undefined;
    const themeColor = menu?.theme?.primaryColor || "#4CAF50";
    
    // Use store image or platform fallback
    const logoUrl = store.imageUrl || ADIRES_LOGO;

    const manifest = {
      id: `adires-biz-${storeId}`,
      name: store.name,
      short_name: store.name.substring(0, 12),
      description: store.description || `Official digital menu for ${store.name}`,
      start_url: `/menu/${storeId}`,
      // Specific scope ensures Grozo doesn't intercept if configured properly
      scope: `/menu/${storeId}`,
      display: "standalone",
      orientation: "portrait",
      background_color: menu?.theme?.backgroundColor || "#ffffff",
      theme_color: themeColor,
      icons: [
        {
          src: logoUrl,
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: logoUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: logoUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ],
    };

    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
    
  } catch (error) {
    console.error(`Failed to generate manifest for store ${storeId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
