'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store, Menu } from "@/lib/types";

// This function handles GET requests to /manifest/[storeId]
// It generates a unique manifest for each restaurant, allowing them to be installed as separate apps.
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

    // Attempt to get the menu to fetch the primary brand color
    const menuSnap = await db.collection("stores").doc(storeId).collection("menus").limit(1).get();
    const menu = menuSnap.docs[0]?.data() as Menu | undefined;
    const themeColor = menu?.theme?.primaryColor || "#4CAF50";

    // Construct the manifest JSON
    // We include a unique 'id' and 'scope' so the browser treats this as a distinct app from the main platform.
    const manifest = {
      id: `localbasket-restaurant-${storeId}`, // CRITICAL: Standard unique identifier for this PWA
      name: store.name,
      short_name: store.name.substring(0, 12),
      description: store.description || `Digital menu and ordering for ${store.name}`,
      start_url: `/menu/${storeId}`,
      scope: `/menu/${storeId}`, // CRITICAL: Restricts the scope to this specific restaurant
      display: "standalone",
      background_color: menu?.theme?.backgroundColor || "#ffffff",
      theme_color: themeColor,
      icons: [
        {
          src: store.imageUrl || "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ],
    };

    // Return the manifest as a JSON response
    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/manifest+json",
      },
    });
    
  } catch (error) {
    console.error(`Failed to generate manifest for store ${storeId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
