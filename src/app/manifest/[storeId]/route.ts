
import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store } from "@/lib/types";

// This function handles GET requests to /manifest/[storeId]
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
    const manifest = {
      name: store.name,
      short_name: store.name.substring(0, 12),
      description: store.description || `Order from ${store.name}`,
      start_url: `/menu/${storeId}`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#4CAF50", // A generic green theme color
      icons: [
        {
          src: store.imageUrl || "/icon-192x192.png", // Fallback to a default icon
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: store.imageUrl || "/icon-512x512.png", // Fallback to a default icon
          sizes: "512x512",
          type: "image/png",
        },
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
