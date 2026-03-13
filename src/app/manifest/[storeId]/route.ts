'use server';

import { getAdminServices } from "@/firebase/admin-init";
import { NextResponse } from "next/server";
import type { Store, Menu } from "@/lib/types";

const ADIRES_LOGO = "https://i.ibb.co/NdxC1XFF/file-000000007de872069c754b2d3cd565ec.png";

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
    const menuSnap = await db.collection("stores").doc(storeId).collection("menus").limit(1).get();
    const menu = menuSnap.docs[0]?.data() as Menu | undefined;
    const themeColor = menu?.theme?.primaryColor || "#4CAF50";

    const manifest = {
      id: `adires-restaurant-${storeId}`,
      name: store.name,
      short_name: store.name.substring(0, 12),
      description: store.description || `Digital menu and ordering for ${store.name}`,
      start_url: `/menu/${storeId}`,
      scope: `/menu/${storeId}`,
      display: "standalone",
      background_color: menu?.theme?.backgroundColor || "#ffffff",
      theme_color: themeColor,
      icons: [
        {
          src: store.imageUrl || ADIRES_LOGO,
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: store.imageUrl || ADIRES_LOGO,
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: store.imageUrl || ADIRES_LOGO,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ],
    };

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
