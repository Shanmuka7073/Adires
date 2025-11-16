'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users, RefreshCw } from 'lucide-react';
import { ServerStatusCard, ClientStatusCard } from './status-cards';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface SystemStatus {
  llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
  serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
  errorMessage: string | null;
  userCount: number | 'N/A';
  storeCount: number | 'N/A';
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus>({
    llmStatus: 'Offline',
    serverDbStatus: 'Loading',
    errorMessage: null,
    userCount: 'N/A',
    storeCount: 'N/A',
  });
  const [isFetching, startFetchingTransition] = useTransition();

  const fetchStatus = async () => {
    startFetchingTransition(async () => {
      try {
        const serverStatus = await getSystemStatus();

        if (serverStatus.status === 'ok') {
            setStatus({
                llmStatus: serverStatus.llmStatus,
                serverDbStatus: 'Online',
                errorMessage: null,
                userCount: 'N/A', // We no longer fetch counts from server
                storeCount: 'N/A',
            });
        } else {
             setStatus({
                llmStatus: 'Offline',
                serverDbStatus: 'Unavailable',
                errorMessage: serverStatus.errorMessage,
                userCount: 'N/A',
                storeCount: 'N/A',
            });
        }
      } catch (error: any) {
        console.error("Failed to fetch system status:", error);
        setStatus(prev => ({
            ...prev,
            llmStatus: 'Offline',
            serverDbStatus: 'Unavailable',
            errorMessage: error.message || 'Client-side fetch failed.',
            userCount: 'N/A',
            storeCount: 'N/A',
        }));
      }
    });
  };

  // Fetch immediately on mount
  useEffect(() => {
    fetchStatus();
    // The interval has been removed.
  }, []);

  const StatusDisplay = ({ isLoading, children }: { isLoading: boolean, children: React.ReactNode }) => {
    return isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{children}</div>;
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
       <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">
                System Status Dashboard
            </h1>
            <p className="text-gray-600">
                Health check of critical application components. Click refresh to get the latest status.
            </p>
        </div>
         <Button onClick={fetchStatus} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ServerStatusCard
          title="Server Database (Admin)"
          status={{
            status: isFetching ? 'Loading' : status.serverDbStatus,
            message: status.errorMessage || `Admin SDK connection is ${status.serverDbStatus.toLowerCase()}.`
          }}
          iconName="Database"
          description="Connection health for server-side actions."
        />
        
        <ClientStatusCard />

        <ServerStatusCard
          title="Authentication Service"
          status={{status: 'Online', message: "Client and Admin Auth services are online."}} 
          iconName="ShieldAlert"
          description="Status of Firebase Authentication services."
        />
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
              <StatusDisplay isLoading={isFetching}>{status.userCount}</StatusDisplay>
              <p className="text-xs text-gray-500">Real-time count not available</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <StoreIcon className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <StatusDisplay isLoading={isFetching}>{status.storeCount}</StatusDisplay>
              <p className="text-xs text-gray-500">Real-time count not available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
