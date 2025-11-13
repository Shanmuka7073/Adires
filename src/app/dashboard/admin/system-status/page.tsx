
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { collection, query, where, limit, getDocs, getCountFromServer, Firestore } from 'firebase/firestore';
import { getAdminServices } from '@/firebase/admin-init';
import { ServerStatusCard, ClientStatusCard } from './status-cards';

async function getMasterStoreStatus(db: Firestore | null) {
    if (!db) return { status: 'error', message: 'Admin Firestore not initialized.' };
    try {
        const adminStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
        const adminStoresSnap = await getDocs(adminStoreQuery);
        if (adminStoresSnap.empty) {
            return { status: 'error', message: 'Master "LocalBasket" store not found.' };
        }
        return { status: 'ok', message: 'Master store is configured.' };
    } catch (e) {
        console.error("Master store check failed:", e);
        return { status: 'error', message: 'Error checking for master store.' };
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
    } catch (e) {
        console.error("Error log check failed:", e);
        return { status: 'error', message: 'Could not check error logs.' };
    }
}

export default async function SystemStatusPage() {
  const { db } = getAdminServices();

  const [
    backendStatus,
    masterStoreStatus,
    errorLogStatus
  ] = await Promise.all([
    getSystemStatus(),
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
