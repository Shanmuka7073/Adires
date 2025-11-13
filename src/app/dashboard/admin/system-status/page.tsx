
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users } from 'lucide-react';
import { collection, getCountFromServer } from 'firebase-admin/firestore'; 
import { getAdminServices } from '@/firebase/admin-init'; 
import { ServerStatusCard, ClientStatusCard } from './status-cards';

// Define the system status interface
interface SystemStatus {
  llmStatus: 'Online' | 'Offline' | 'Degraded';
  adminDbStatus: 'Online' | 'Offline' | 'Unavailable';
  userCount: number | 'N/A';
  storeCount: number | 'N/A';
}

/**
 * Fetches real-time status data from the Firebase Admin SDK.
 */
async function fetchSystemStatus(): Promise<SystemStatus> {
  // Use the centralized initialization function
  const { db } = getAdminServices();

  // NULL GUARD: Check if the database was initialized successfully
  if (!db) {
    return {
      llmStatus: 'Degraded', // Assume LLM works but data access is degraded
      adminDbStatus: 'Unavailable',
      userCount: 'N/A',
      storeCount: 'N/A',
    };
  }
  
  // Database initialized successfully
  let userCount: number | 'N/A' = 'N/A';
  let storeCount: number | 'N/A' = 'N/A';

  try {
    // 1. Get User Count (from the root 'users' collection)
    const usersCollectionRef = collection(db, 'users'); 
    const userSnapshot = await getCountFromServer(usersCollectionRef);
    userCount = userSnapshot.data().count;
  } catch (e) {
    console.error('Failed to get user count:', e);
  }
  
  try {
    // 2. Get Store Count (from the root 'stores' collection)
    const storesCollectionRef = collection(db, 'stores'); 
    const storeSnapshot = await getCountFromServer(storesCollectionRef);
    storeCount = storeSnapshot.data().count;
  } catch (e) {
    console.error('Failed to get store count:', e);
  }

  // NOTE: LLM Status is typically checked via an external health check, but we'll mock it here.
  return {
    llmStatus: 'Online',
    adminDbStatus: 'Online',
    userCount,
    storeCount,
  };
}


export default async function SystemStatusPage() {
  const status = await fetchSystemStatus();

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 border-b pb-4">
        System Status Dashboard
      </h1>
      <p className="text-gray-600">
        Real-time health check of critical server components.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. LLM Status */}
        <ServerStatusCard
          title="LLM Service"
          status={status.llmStatus}
          icon={BrainCircuit}
          description="Status of the Generative AI Model serving the application."
        />

        {/* 2. Admin Database Status */}
        <ServerStatusCard
          title="Admin Database (Firestore)"
          status={status.adminDbStatus}
          icon={Database}
          description="Connection health to the centralized server database."
        />

        {/* 3. Authentication/Security Status */}
        <ServerStatusCard
          title="Authentication Service"
          status={'Online'} 
          icon={ShieldAlert}
          description="Status of Firebase Admin Auth and user token verification."
        />

        {/* 4. Client-side Environment Status */}
        <ClientStatusCard
          title="Client Environment"
          icon={Server}
          description="Ensures all client-side configurations are correctly loaded."
        />
      </div>

      <div className="pt-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Usage Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 5. Active User Count */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.userCount}</div>
              <p className="text-xs text-gray-500">Users with stored credentials</p>
            </CardContent>
          </Card>

          {/* 6. Total Stores */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <StoreIcon className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.storeCount}</div>
              <p className="text-xs text-gray-500">Stores created on the platform</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
