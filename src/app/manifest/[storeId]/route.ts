
'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store, Menu } from "@/lib/types";

// The official Adires Platform Logo (fallback branding)
const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Dynamic Manifest API (Resilient Identity)
 * Generates a store-specific manifest with a localized scope and UNIQUE ID.
 * Optimized to ensure "PRAVEEN" or any store name shows correctly in the install prompt.
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
    
    if (!db) {
        throw new Error("Admin SDK missing");
    }

    const storeDoc = await db.collection("stores").doc(storeId).get();

    if (!storeDoc.exists) {
      throw new Error("Store not found");
    }

    const store = storeDoc.data() as Store;
    
    // Fetch menu to get theme color
    const menuSnap = await db.collection("stores").doc(storeId).collection("menus").limit(1).get();
    const menu = menuSnap.docs[0]?.data() as Menu | undefined;
    const themeColor = menu?.theme?.primaryColor || "#90EE90";
    
    const logoUrl = store.imageUrl || ADIRES_LOGO;
    const cleanName = store.name || storeId.replace(/-/g, ' ').toUpperCase();

    const manifest = {
      id: `adires-v2-id-${storeId}`, // Unique ID for this specific store
      name: cleanName,
      short_name: cleanName.substring(0, 12),
      description: store.description || `Official app for ${cleanName}`,
      start_url: `/menu/${storeId}`,
      scope: `/menu/${storeId}`,
      display: "standalone",
      orientation: "portrait",
      background_color: menu?.theme?.backgroundColor || "#ffffff",
      theme_color: themeColor,
      icons: [
        {
          src: logoUrl,
          sizes: "192x192",
          // Type is omitted to allow jpeg/webp/png flexibility
          purpose: "any"
        },
        {
          src: logoUrl,
          sizes: "512x512",
          purpose: "any"
        },
        {
          src: logoUrl,
          sizes: "512x512",
          purpose: "maskable"
        }
      ],
    };

    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
    
  } catch (error) {
    console.error(`Manifest Fallback for ${storeId}:`, error);
    
    // Improved Fallback: Even if DB fails, use the ID from the URL to guess the name
    const guessedName = storeId.split('-')[0].toUpperCase();
    
    const fallbackManifest = {
        id: `adires-fallback-${storeId}`,
        name: guessedName || "My Store",
        short_name: guessedName || "Store",
        start_url: `/menu/${storeId}`,
        scope: `/menu/${storeId}`,
        display: "standalone",
        icons: [{ src: ADIRES_LOGO, sizes: "192x192" }]
    };
    
    return NextResponse.json(fallbackManifest, {
        status: 200,
        headers: { "Content-Type": "application/manifest+json" }
    });
  }
}
