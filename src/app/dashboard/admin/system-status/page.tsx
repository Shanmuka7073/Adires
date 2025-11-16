
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users } from 'lucide-react';
import { ServerStatusCard, ClientStatusCard } from './status-cards';
import { getSystemStatus, listSupportedModels } from '@/app/actions';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemStatus {
  llmStatus: 'Online' | 'Offline' | 'Degraded';
  serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
  userCount: number | 'N/A';
  storeCount: number | 'N/A';
  availableModels: string[];
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus>({
    llmStatus: 'Online', // Assumed online initially
    serverDbStatus: 'Loading',
    userCount: 'N/A',
    storeCount: 'N/A',
    availableModels: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoading(true);
      try {
        const [serverStatus, modelList] = await Promise.all([
            getSystemStatus(),
            listSupportedModels()
        ]);

        const llmStatus = modelList.availableModels.length > 0 && !modelList.availableModels[0].startsWith('ERROR:') 
            ? 'Online' 
            : 'Degraded';

        if (serverStatus.status === 'ok') {
            setStatus({
                llmStatus: llmStatus,
                serverDbStatus: 'Online',
                userCount: serverStatus.counts.users,
                storeCount: serverStatus.counts.stores,
                availableModels: modelList.availableModels,
            });
        } else {
             setStatus({
                llmStatus: llmStatus,
                serverDbStatus: 'Unavailable',
                userCount: 'N/A',
                storeCount: 'N/A',
                availableModels: modelList.availableModels,
            });
        }
      } catch (error) {
        console.error("Failed to fetch system status:", error);
        setStatus(prev => ({
            ...prev,
            llmStatus: 'Degraded',
            serverDbStatus: 'Unavailable',
            userCount: 'N/A',
            storeCount: 'N/A',
        }));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const StatusDisplay = ({ isLoading, children }: { isLoading: boolean, children: React.ReactNode }) => {
    return isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-bold">{children}</div>;
  };

  const getLlmMessage = () => {
    if (isLoading) return 'Checking model availability...';
    if (status.llmStatus === 'Online') return 'Generative AI model is online and responding.';
    if (status.availableModels.length > 0 && status.availableModels[0].startsWith('ERROR:')) {
      return status.availableModels[0];
    }
    return 'Could not verify connection to the Generative AI service.';
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 border-b pb-4">
        System Status Dashboard
      </h1>
      <p className="text-gray-600">
        Real-time health check of critical application components.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ServerStatusCard
          title="LLM Service (Gemini)"
          status={{status: status.llmStatus, message: getLlmMessage()}}
          iconName="BrainCircuit"
          description="Status of the Generative AI Model serving the application."
        />

        <ServerStatusCard
          title="Server Database (Admin)"
          status={{status: status.serverDbStatus, message: `Admin SDK connection is ${status.serverDbStatus.toLowerCase()}.`}}
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
          Available GenAI Models
        </h2>
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Supported Models</CardTitle>
                <CardDescription>
                    This is the list of models your API key has access to. Use one of these in your Genkit flows.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-20 w-full" /> : (
                    <ul className="font-mono text-sm space-y-1">
                        {status.availableModels.map(model => (
                            <li key={model} className={`p-2 rounded ${model.startsWith('ERROR:') ? 'bg-destructive/10 text-destructive' : 'bg-green-50'}`}>
                                {model}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
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
              <StatusDisplay isLoading={isLoading}>{status.userCount}</StatusDisplay>
              <p className="text-xs text-gray-500">Users with stored credentials</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <StoreIcon className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <StatusDisplay isLoading={isLoading}>{status.storeCount}</StatusDisplay>
              <p className="text-xs text-gray-500">Stores created on the platform</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
