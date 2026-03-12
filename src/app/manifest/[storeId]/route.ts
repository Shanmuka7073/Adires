
'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store } from "@/lib/types";

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

    // Construct the manifest JSON
    // We include a unique 'id' and 'scope' so the browser treats this as a distinct app from the main platform.
    const manifest = {
      id: `/menu/${storeId}`, // CRITICAL: Unique identity for this specific restaurant's PWA
      name: store.name,
      short_name: store.name.substring(0, 12),
      description: store.description || `Order from ${store.name}`,
      start_url: `/menu/${storeId}`,
      scope: `/menu/${storeId}`, // CRITICAL: Scope the PWA to only this restaurant's path
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#4CAF50",
      icons: [
        {
          src: store.imageUrl || "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: store.imageUrl || "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: store.imageUrl || "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
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
