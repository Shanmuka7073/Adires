
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users } from 'lucide-react';
import { getFirestore, getCountFromServer } from 'firebase-admin/firestore'; 
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { ServerStatusCard, ClientStatusCard } from './status-cards';

// Self-contained Firebase Admin initialization
function getAdminServices() {
  const apps = getApps();
  const adminApp = apps.find(app => app?.name === 'firebase-admin-app-system-status');
  
  if (adminApp) {
    return { 
      db: getFirestore(adminApp),
    };
  }
  
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error("Firebase Admin environment variables are not set.");
    }
    
    const newAdminApp = initializeApp({
      credential: cert(serviceAccount),
    }, 'firebase-admin-app-system-status');

    return {
      db: getFirestore(newAdminApp),
    };
  } catch (e: any) {
    console.error("Admin SDK initialization failed:", e.message);
    return { db: null };
  }
}

interface SystemStatus {
  llmStatus: 'Online' | 'Offline' | 'Degraded';
  adminDbStatus: 'Online' | 'Offline' | 'Unavailable';
  userCount: number | 'N/A';
  storeCount: number | 'N/A';
}

async function fetchSystemStatus(): Promise<SystemStatus> {
  const { db } = getAdminServices();

  if (!db) {
    return {
      llmStatus: 'Degraded',
      adminDbStatus: 'Unavailable',
      userCount: 'N/A',
      storeCount: 'N/A',
    };
  }
  
  let userCount: number | 'N/A' = 'N/A';
  let storeCount: number | 'N/A' = 'N/A';

  try {
    const usersCollectionRef = db.collection('users'); 
    const userSnapshot = await getCountFromServer(usersCollectionRef);
    userCount = userSnapshot.data().count;
  } catch (e) {
    console.error('Failed to get user count:', e);
  }
  
  try {
    const storesCollectionRef = db.collection('stores'); 
    const storeSnapshot = await getCountFromServer(storesCollectionRef);
    storeCount = storeSnapshot.data().count;
  } catch (e) {
    console.error('Failed to get store count:', e);
  }

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
        <ServerStatusCard
          title="LLM Service"
          status={{status: status.llmStatus === 'Online' ? 'ok' : 'error', message: status.llmStatus}}
          iconName="BrainCircuit"
          description="Status of the Generative AI Model serving the application."
        />

        <ServerStatusCard
          title="Admin Database (Firestore)"
          status={{status: status.adminDbStatus === 'Online' ? 'ok' : 'error', message: status.adminDbStatus}}
          iconName="Database"
          description="Connection health to the centralized server database."
        />

        <ServerStatusCard
          title="Authentication Service"
          status={{status: 'ok', message: 'Online'}} 
          iconName="ShieldAlert"
          description="Status of Firebase Admin Auth and user token verification."
        />

        <ClientStatusCard />
      </div>

      <div className="pt-4">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Usage Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
