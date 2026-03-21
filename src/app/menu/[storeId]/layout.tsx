import type { Metadata } from "next";
import { getAdminServices } from "@/firebase/admin-init";

/**
 * Dynamic Metadata for Restaurant Menus
 * Links the page to a unique, store-specific manifest for branded PWA installation.
 */
export async function generateMetadata({ params }: { params: { storeId: string } }): Promise<Metadata> {
  const { storeId } = params;
  
  try {
    const { db } = await getAdminServices();
    const storeDoc = await db.collection("stores").doc(storeId).get();
    
    if (!storeDoc.exists) {
      return { title: 'Menu | Adires' };
    }

    const store = storeDoc.data();
    
    return {
      title: `${store?.name} | Digital Menu`,
      description: store?.description || 'Order directly from our digital menu.',
      // The key change: dynamic manifest URL
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
