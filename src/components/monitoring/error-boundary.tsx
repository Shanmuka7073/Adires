
'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { logEvent } from '@/lib/monitoring/logger';
import { Firestore } from 'firebase/firestore';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  db: Firestore | null;
  userId?: string;
  accountType?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logEvent(this.props.db, {
      message: error.message,
      stack: errorInfo.componentStack || undefined,
      type: 'react_component_error',
      severity: 'critical',
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      userId: this.props.userId,
      accountType: this.props.accountType,
      metadata: { errorName: error.name }
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <Card className="max-w-md w-full rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-red-50 text-center py-10">
              <div className="h-16 w-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto text-red-600 mb-4">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight text-red-950">Component Crash</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center space-y-6">
              <p className="text-sm font-medium text-gray-600 leading-relaxed uppercase">
                An isolated part of the interface failed to load. The system has logged this incident for the engineers.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-red-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Restart Hub
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
