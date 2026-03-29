
import type { Metadata } from "next";

/**
 * Dynamic Metadata for Restaurant/Salon Menus
 * Points to the dynamic manifest route to ensure "Install App" shows correct branding.
 */
export async function generateMetadata({ params }: { params: { storeId: string } }): Promise<Metadata> {
  const { storeId } = params;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${storeId}`,
      { next: { revalidate: 60 } }
    );

    if (response.ok) {
      const data = await response.json();
      const storeName = data.fields?.name?.stringValue || storeId;
      const description = data.fields?.description?.stringValue || 'Digital Menu & Appointment Hub';

      return {
        title: `${storeName} | Adires`,
        description: description,
        // Point to the specific dynamic manifest for this business
        manifest: `/manifest/${storeId}.webmanifest`
      };
    }

    return {
      title: `${storeId.toUpperCase()} | Adires`,
      manifest: `/manifest/${storeId}.webmanifest`
    };
  } catch (e) {
    return {
      title: 'Digital Menu | Adires',
      manifest: `/manifest/${storeId}.webmanifest`
    };
  }
}

export default function MenuPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="relative">
          {children}
      </div>
  );
}
