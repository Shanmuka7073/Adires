
import type { Metadata } from "next";

/**
 * Dynamic Metadata for Restaurant Menus
 * Uses REST API for high reliability in production environments.
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
      const description = data.fields?.description?.stringValue || 'Digital Menu';

      return {
        title: `${storeName} | Adires`,
        description: description,
        manifest: `/manifest/${storeId}`
      };
    }

    return {
      title: `${storeId.toUpperCase()} | Adires`,
      manifest: `/manifest/${storeId}`
    };
  } catch (e) {
    return {
      title: 'Digital Menu | Adires',
      manifest: `/manifest/${storeId}`
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
