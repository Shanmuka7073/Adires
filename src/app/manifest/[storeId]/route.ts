
import { NextResponse } from "next/server";

// The official Adires Platform Logo (fallback branding)
const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Dynamic Manifest API (Ultra-Resilient REST Version)
 * Uses the Firestore REST API to bypass Admin SDK credential issues on production.
 */
export async function GET(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!storeId || !projectId) {
    return new NextResponse("Missing context", { status: 400 });
  }

  // DEFAULT FALLBACKS
  let name = storeId.toUpperCase();
  let imageUrl = ADIRES_LOGO;
  let themeColor = "#90EE90";
  let backgroundColor = "#ffffff";

  try {
    const storeRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${storeId}`,
      { next: { revalidate: 60 } } 
    );

    if (storeRes.ok) {
      const data = await storeRes.json();
      const fields = data.fields;
      
      if (fields?.name?.stringValue) name = fields.name.stringValue;
      if (fields?.imageUrl?.stringValue) imageUrl = fields.imageUrl.stringValue;

      const menuRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${storeId}/menus`,
        { next: { revalidate: 60 } }
      );
      
      if (menuRes.ok) {
          const menuData = await menuRes.json();
          const firstMenu = menuData.documents?.[0];
          if (firstMenu?.fields?.theme?.mapValue?.fields) {
              const themeFields = firstMenu.fields.theme.mapValue.fields;
              if (themeFields.primaryColor?.stringValue) themeColor = themeFields.primaryColor.stringValue;
              if (themeFields.backgroundColor?.stringValue) backgroundColor = themeFields.backgroundColor.stringValue;
          }
      }
    }
  } catch (error) {
    console.error(`Manifest REST error for ${storeId}:`, error);
  }

  const manifest = {
    id: `adires-v4-${storeId}`, 
    name: name,
    short_name: name.substring(0, 12),
    description: `Official app for ${name}`,
    start_url: `/menu/${storeId}?v=4`,
    scope: `/menu/${storeId}`,
    display: "standalone",
    display_override: ["standalone", "window-controls-overlay"],
    orientation: "portrait",
    lang: "en",
    dir: "ltr",
    categories: ["food", "shopping"],
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: imageUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: imageUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: imageUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
