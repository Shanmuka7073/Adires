
import StoreCard from '@/components/store-card';
import { getStores } from '@/lib/data';
import { getAdminServices } from '@/firebase/admin-init';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}


export default async function StoresPage() {
  const { db } = getAdminServices();
  const allStores = await getStores(db);

  // Sorting can be done on the server. For this example, we'll assume a fixed location
  // or pass client location via headers/cookies in a more advanced setup.
  // For now, we'll just display them as is.

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="space-y-4 mb-8">
        <h1 className="text-4xl font-bold font-headline">Browse All Stores</h1>
        <p className="text-muted-foreground text-lg">Find your new favorite local grocery store.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {allStores.length > 0 ? (
          allStores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))
        ) : (
           <p className="text-muted-foreground">No stores have been created yet.</p>
        )}
      </div>
    </div>
  );
}
