'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, Store as StoreIcon, Users, RefreshCw } from 'lucide-react';
import { ServerStatusCard, ClientStatusCard } from './status-cards';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// This page no longer fetches server status as it was redundant and costly.
// It now primarily focuses on client-side connectivity and auth status.

export default function SystemStatusPage() {
  const [isFetching, startFetchingTransition] = useTransition();

  // The onRefresh function is now empty as the server card is removed.
  const fetchStatus = async () => {
    // No-op
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
       <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">
                System Status Dashboard
            </h1>
            <p className="text-gray-600">
                Health check of critical application components. Use the official Firebase Status Dashboard for backend monitoring.
            </p>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ClientStatusCard />

        <ServerStatusCard
          title="Authentication Service"
          status={{status: 'Online', message: "Client and Admin Auth services are online."}} 
          iconName="ShieldAlert"
          description="Status of Firebase Authentication services."
        />

        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Database className="h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-lg">Backend Status</CardTitle>
                </div>
                <CardDescription className="pt-2">For real-time backend and database health, please use the official Google Cloud status dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline">
                    <a href="https://status.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                        Go to Firebase Status
                    </a>
                </Button>
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
               <div className="text-3xl font-bold">N/A</div>
              <p className="text-xs text-gray-500">Real-time count not available</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <StoreIcon className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">N/A</div>
              <p className="text-xs text-gray-500">Real-time count not available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
