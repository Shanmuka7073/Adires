
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNLUDashboard } from './nlu-dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export function ApprovedRulesPanel() {
  const { approvedSentences, isLoading } = useNLUDashboard();

  const formatDateSafe = (date: any) => {
    if (!date) return 'N/A';
    const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return formatDistanceToNow(jsDate, { addSuffix: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approved Grammar Rules</CardTitle>
        <CardDescription>
          This is a list of all sentences you have approved. The rules derived from them have been added to `learned-rules.json` and are now part of the NLU engine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full"/>
                <Skeleton className="h-10 w-full"/>
                <Skeleton className="h-10 w-full"/>
            </div>
        ) : !approvedSentences || approvedSentences.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No rules have been approved yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Approved Sentence</TableHead>
                <TableHead>Approved On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedSentences.map((sentence) => (
                <TableRow key={sentence.id}>
                  <TableCell className="font-mono text-sm">{sentence.rawText}</TableCell>
                  <TableCell>{formatDateSafe(sentence.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
