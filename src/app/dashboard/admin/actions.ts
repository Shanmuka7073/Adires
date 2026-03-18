
'use server';

import { getAdminServices } from '@/firebase/admin-init';

export async function getGlobalPlatformStats() {
  const { db } = await getAdminServices();

  const usersCollection = db.collection('users');
  const storesCollection = db.collection('stores');
  const ordersCollection = db.collection('orders');

  const usersSnapshot = await usersCollection.count().get();
  const storesSnapshot = await storesCollection.count().get();
  const ordersSnapshot = await ordersCollection.where('status', 'in', ['Delivered', 'Completed']).count().get();

  return {
    totalUsers: usersSnapshot.data().count,
    totalStores: storesSnapshot.data().count,
    totalOrdersDelivered: ordersSnapshot.data().count,
  };
}
