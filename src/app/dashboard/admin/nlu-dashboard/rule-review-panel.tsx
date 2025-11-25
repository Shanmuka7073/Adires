
'use client';

import React, { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { approveRule, rejectRule } from '@/app/actions';
import { useNLUDashboard } from './nlu-dashboard-context';
import { NluExtractedSentence } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

function ReviewRow({ sentence }: { sentence: NluExtractedSentence }) {
    const { toast } = useToast();
    const [isApproving, startApprove] = useTransition();
    const [isRejecting, startReject] = useTransition();
    const { refreshData } = useNLUDashboard();

    const handleApprove = () => {
        startApprove(async () => {
            const result = await approveRule(sentence.id, sentence.rawText);
            if (result.success) {
                toast({ title: 'Rule Approved!', description: 'The new grammar rule has been added to learned-rules.json.' });
                refreshData();
            } else {
                toast({ variant: 'destructive', title: 'Approval Failed', description: result.error });
            }
        });
    };

    const handleReject = () => {
        startReject(async () => {
            const result = await rejectRule(sentence.id);
            if (result.success) {
                toast({ title: 'Rule Rejected' });
                refreshData();
            } else {
                toast({ variant: 'destructive', title: 'Rejection Failed', description: result.error });
            }
        });
    };

    const isProcessing = isApproving || isRejecting;

    return (
        <TableRow>
            <TableCell className="max-w-md">
                <p className="font-mono text-sm">{sentence.rawText}</p>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {sentence.extractedNumbers.length > 0 ? sentence.extractedNumbers.map((num, i) => (
                        <Badge key={i} variant="secondary" className="font-normal">
                            {num.raw} &rarr; {num.normalizedValue} ({num.meaningType})
                        </Badge>
                    )) : <Badge variant="outline">None</Badge>}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={sentence.confidence > 0.7 ? 'default' : sentence.confidence > 0.4 ? 'secondary' : 'destructive'}>
                    {(sentence.confidence * 100).toFixed(0)}%
                </Badge>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={handleApprove} disabled={isProcessing}>
                        {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                        Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleReject} disabled={isProcessing}>
                         {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                        Reject
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

export function RuleReviewPanel() {
  const { pendingSentences, isLoading } = useNLUDashboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Review Pending Rules</CardTitle>
        <CardDescription>
          Review the sentences extracted from your documents. Approve the ones that represent good grammar rules to teach the NLU engine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-12 w-full"/>
                <Skeleton className="h-12 w-full"/>
                <Skeleton className="h-12 w-full"/>
            </div>
        ) : !pendingSentences || pendingSentences.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No pending rules to review.</p>
            <p className="text-sm">Upload a PDF to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sentence</TableHead>
                <TableHead>Extracted Numbers</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingSentences.map((sentence) => (
                <ReviewRow key={sentence.id} sentence={sentence} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
