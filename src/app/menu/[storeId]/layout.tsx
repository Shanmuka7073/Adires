
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { storeId: string } }): Promise<Metadata> {
  // In a real app, you would fetch store details here to set the title dynamically
  // For now, we generate a dynamic manifest link
  return {
    title: 'Restaurant Menu',
    description: 'Order from our digital menu.',
    manifest: `/manifest/${params.storeId}`
  };
}

export default function MenuPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
