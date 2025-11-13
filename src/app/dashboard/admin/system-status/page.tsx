
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { collection, query, where, limit, getDocs, getCountFromServer, Firestore } from 'firebase/firestore';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ServerStatusCard, ClientStatusCard } from './status-cards';


// Self-contained admin initialization
function getDb() {
    const apps = getApps();
    // Use a specific name for the admin app to avoid conflicts
    const adminApp = apps.find(app => app?.name === 'firebase-admin-app-db-status');
    if (adminApp) {
        return getFirestore(adminApp);
    }
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error('Required Firebase Admin environment variables for db are not set for System Status Page.');
        return null; // Return null if config is missing
    }

    try {
        const newAdminApp = initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        }, 'firebase-admin-app-db-status'); // Give the app a unique name
        return getFirestore(newAdminApp);
    } catch(e: any) {
        console.error("Failed to initialize admin db in SystemStatusPage:", e.message);
        return null; // Return null on initialization failure
    }
}


async function getMasterStoreStatus(db: Firestore | null) {
    if (!db) return { status: 'error', message: 'Admin Firestore not initialized.' };
    try {
        const adminStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
        const adminStoresSnap = await getDocs(adminStoreQuery);
        if (adminStoresSnap.empty) {
            return { status: 'error', message: 'Master "LocalBasket" store not found.' };
        }
        return { status: 'ok', message: 'Master store is configured.' };
    } catch (e: any) {
        console.error("Master store check failed:", e);
        return { status: 'error', message: 'Error checking for master store: ' + e.message };
    }
}

async function getErrorLogStatus(db: Firestore | null) {
     if (!db) return { status: 'error', message: 'Admin Firestore not initialized.' };
    try {
        const errorsQuery = collection(db, 'appErrors');
        const snapshot = await getCountFromServer(errorsQuery);
        const errorCount = snapshot.data().count;

        if (errorCount > 0) {
            return { status: 'error', message: `${errorCount} error(s) logged. Review required.` };
        }
        return { status: 'ok', message: 'No errors logged.' };
    } catch (e: any) {
        console.error("Error log check failed:", e);
        return { status: 'error', message: 'Could not check error logs: ' + e.message };
    }
}

export default async function SystemStatusPage() {
  // Initialize DB right here in the component.
  const db = getDb();

  const [
    backendStatus,
    masterStoreStatus,
    errorLogStatus
  ] = await Promise.all([
    getSystemStatus(),
    // Pass the initialized db instance directly.
    getMasterStoreStatus(db),
    getErrorLogStatus(db)
  ]);

  const serverStatuses = [
    { 
        title: "Backend Services & User Count", 
        description: "Checks if server actions are responsive and gets total users from Firebase Auth.", 
        status: backendStatus, 
        iconName: "Users" as const
    },
    { 
        title: "Master Store", 
        description: "Ensures the master 'LocalBasket' store for canonical products exists.", 
        status: masterStoreStatus, 
        iconName: "StoreIcon" as const
    },
    { 
        title: "Application Error Log", 
        description: "Monitors for logged application or permission errors in Firestore.", 
        status: errorLogStatus, 
        iconName: "ShieldAlert" as const,
        link: '/dashboard/admin/errors'
    },
  ];

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-headline">System Health Check</h1>
        <p className="text-lg text-muted-foreground mt-2">
          An overview of your application's core services and configurations.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-bold mb-4">Server-Side Checks</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serverStatuses.map(s => (
            <ServerStatusCard 
                key={s.title}
                title={s.title}
                description={s.description}
                status={s.status}
                iconName={s.iconName}
                link={s.link}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold mb-4 mt-12">Client-Side Checks</h2>
         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ClientStatusCard />
         </div>
      </div>
    </div>
  );
}
