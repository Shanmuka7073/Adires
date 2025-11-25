
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { NluExtractedSentence } from '@/lib/types';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

interface NLUDashboardContextType {
  pendingSentences: NluExtractedSentence[] | null;
  approvedSentences: NluExtractedSentence[] | null;
  rejectedSentences: NluExtractedSentence[] | null;
  isLoading: boolean;
  refreshData: () => void;
}

const NLUDashboardContext = createContext<NLUDashboardContextType | undefined>(undefined);

export const NLUDashboardProvider = ({ children }: { children: ReactNode }) => {
  const { firestore } = useFirebase();
  const [refreshKey, setRefreshKey] = useState(0);

  const baseQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'nlu_extracted_sentences');
  }, [firestore, refreshKey]);

  const pendingQuery = useMemoFirebase(() => baseQuery ? query(baseQuery, where('status', '==', 'pending'), orderBy('createdAt', 'desc')) : null, [baseQuery]);
  const approvedQuery = useMemoFirebase(() => baseQuery ? query(baseQuery, where('status', '==', 'approved'), orderBy('createdAt', 'desc')) : null, [baseQuery]);
  const rejectedQuery = useMemoFirebase(() => baseQuery ? query(baseQuery, where('status', '==', 'rejected'), orderBy('createdAt', 'desc')) : null, [baseQuery]);

  const { data: pendingSentences, isLoading: pendingLoading } = useCollection<NluExtractedSentence>(pendingQuery);
  const { data: approvedSentences, isLoading: approvedLoading } = useCollection<NluExtractedSentence>(approvedQuery);
  const { data: rejectedSentences, isLoading: rejectedLoading } = useCollection<NluExtractedSentence>(rejectedQuery);

  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const value = {
    pendingSentences,
    approvedSentences,
    rejectedSentences,
    isLoading: pendingLoading || approvedLoading || rejectedLoading,
    refreshData,
  };

  return (
    <NLUDashboardContext.Provider value={value}>
      {children}
    </NLUDashboardContext.Provider>
  );
};

export const useNLUDashboard = () => {
  const context = useContext(NLUDashboardContext);
  if (context === undefined) {
    throw new Error('useNLUDashboard must be used within a NLUDashboardProvider');
  }
  return context;
};
