
'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store, Menu } from "@/lib/types";

// The official Adires Platform Logo (fallback branding)
const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Dynamic Manifest API (Resilient Identity)
 * Generates a store-specific manifest with a localized scope and UNIQUE ID.
 * Optimized for high reliability across Android and iOS.
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
    const menu = menuSnap.empty ? undefined : (menuSnap.docs[0].data() as Menu);
    
    const themeColor = menu?.theme?.primaryColor || "#90EE90";
    const logoUrl = store.imageUrl || ADIRES_LOGO;
    
    // Create a human-readable fallback name if store.name is somehow missing
    const rawName = store.name || storeId.replace(/[^a-zA-Z0-9]/g, ' ');
    const cleanName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    const manifest = {
      // V3 ID includes store update time or timestamp to break cache
      id: `adires-v3-${storeId}-${Date.now()}`, 
      name: cleanName,
      short_name: cleanName.substring(0, 12) || "Store",
      description: store.description || `Official app for ${cleanName}`,
      
      // Query param ensures the browser treats this as a fresh start point
      start_url: `/menu/${storeId}?v=${Date.now()}`,
      scope: `/menu/${storeId}`,
      
      display: "standalone",
      display_override: ["standalone", "window-controls-overlay"],
      orientation: "portrait",
      
      lang: "en",
      dir: "ltr",
      categories: ["food", "shopping", "lifestyle"],

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
        "Cache-Control": "no-cache, no-store, must-revalidate", // Prevent manifest caching
      },
    });
    
  } catch (error) {
    console.error(`Manifest Fallback for ${storeId}:`, error);
    
    // Robust Fallback: capitalize the ID and provide standard platform icons
    const fallbackName = storeId.slice(0, 8).toUpperCase();
    
    const fallbackManifest = {
        id: `adires-fallback-${storeId}`,
        name: fallbackName,
        short_name: fallbackName,
        start_url: `/menu/${storeId}`,
        scope: `/menu/${storeId}`,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#90EE90",
        icons: [
            { src: ADIRES_LOGO, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: ADIRES_LOGO, sizes: "512x512", type: "image/png", purpose: "any" }
        ]
    };
    
    return NextResponse.json(fallbackManifest, {
        status: 200,
        headers: { "Content-Type": "application/manifest+json" }
    });
  }
}
