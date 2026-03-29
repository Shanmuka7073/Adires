
import { NextResponse } from "next/server";

// The official Adires Platform Logo (fallback branding)
const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Dynamic Manifest API (Hardened)
 * Strips extensions and fetches real business identity for the PWA Install prompt.
 */
export async function GET(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  // 1. Strip .webmanifest or .json extensions from the ID
  const storeId = params.storeId.replace(/\.(webmanifest|json)$/, "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!storeId || !projectId) {
    return new NextResponse("Missing context", { status: 400 });
  }

  let name = "Adires Hub";
  let imageUrl = ADIRES_LOGO;
  let themeColor = "#10B981"; // Primary Green
  let backgroundColor = "#ffffff";

  try {
    // 2. Fetch business identity directly from Firestore REST API for reliability
    const storeRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${storeId}`,
      { next: { revalidate: 60 } } 
    );

    if (storeRes.ok) {
      const data = await storeRes.json();
      const fields = data.fields;
      
      // Use the actual business name and logo
      if (fields?.name?.stringValue) name = fields.name.stringValue;
      if (fields?.imageUrl?.stringValue) imageUrl = fields.imageUrl.stringValue;
    }
  } catch (error) {
    console.error(`[MANIFEST_ERROR] Failed for ${storeId}:`, error);
  }

  const manifest = {
    id: `adires-business-${storeId}`, 
    name: name,
    short_name: name.substring(0, 12),
    description: `Official digital hub for ${name}. Order, book, and manage directly.`,
    start_url: `/menu/${storeId}?install=true`,
    scope: `/menu/${storeId}`,
    display: "standalone",
    orientation: "portrait",
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: imageUrl || ADIRES_LOGO,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: imageUrl || ADIRES_LOGO,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: imageUrl || ADIRES_LOGO,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
