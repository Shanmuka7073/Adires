
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BellRing, Send, Loader2, CheckCircle2, Users } from 'lucide-react';
import { sendBroadcastNotification } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

export default function BroadcastPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSending, startBroadcast] = useTransition();
    
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [result, setResult] = useState<any>(null);

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;
    if (!isAdmin) { router.replace('/dashboard'); return null; }

    const handleSend = () => {
        if (!title.trim() || !body.trim()) {
            toast({ variant: 'destructive', title: 'Content Required', description: 'Please enter both title and message body.' });
            return;
        }

        startBroadcast(async () => {
            try {
                const res = await sendBroadcastNotification(title, body);
                if (res.success && res.results) {
                    setResult(res.results);
                    setTitle('');
                    setBody('');
                    toast({ 
                        title: 'Broadcast Sent!', 
                        description: `Successfully delivered to ${res.results.successCount} devices.` 
                    });
                } else {
                    throw new Error(res.error || 'Broadcast failed.');
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: error.message });
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-3xl space-y-12 pb-32">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Broadcast</h1>
                <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Global Platform Push Notifications</p>
            </div>

            <div className="grid gap-8">
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <BellRing className="h-4 w-4 text-primary" /> Compose Notification
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Notification Title</Label>
                            <Input 
                                placeholder="e.g., Happy Diwali! 🪔" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="h-12 rounded-xl border-2 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Message Body</Label>
                            <Textarea 
                                placeholder="Write your announcement here..." 
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 font-medium"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="p-8 bg-gray-50 border-t border-black/5">
                        <Button 
                            onClick={handleSend} 
                            disabled={isSending}
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                        >
                            {isSending ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Distributing Payload...</>
                            ) : (
                                <><Send className="mr-2 h-5 w-5" /> Launch Broadcast</>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {result && (
                    <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden animate-in zoom-in-95 duration-500">
                        <CardHeader className="bg-green-50 pb-4">
                            <CardTitle className="text-xs font-black uppercase tracking-tight text-green-800 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Transmission Complete
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 grid grid-cols-3 gap-4">
                            <div className="text-center p-4 rounded-2xl bg-muted/30">
                                <p className="text-[8px] font-black uppercase opacity-40 mb-1">Targeted</p>
                                <p className="text-xl font-black">{result.totalTokens}</p>
                            </div>
                            <div className="text-center p-4 rounded-2xl bg-green-100">
                                <p className="text-[8px] font-black uppercase text-green-800 opacity-40 mb-1">Delivered</p>
                                <p className="text-xl font-black text-green-600">{result.successCount}</p>
                            </div>
                            <div className="text-center p-4 rounded-2xl bg-red-50">
                                <p className="text-[8px] font-black uppercase text-red-800 opacity-40 mb-1">Failed</p>
                                <p className="text-xl font-black text-red-500">{result.failureCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white flex items-start gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary shrink-0">
                        <Users className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-black uppercase text-xs tracking-tight">Broadcast Protocol</h3>
                        <p className="text-[10px] font-bold text-white/40 leading-relaxed uppercase">
                            This tool pushes notifications to every registered device ID in the system. Use sparingly for platform-wide updates, holiday greetings, or emergency maintenance alerts.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
