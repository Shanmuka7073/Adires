'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore";
import { getAuth, type User as FirebaseAuthUser } from 'firebase/auth';
import { Send, Mic, User as UserIcon, Bot, Loader2 } from 'lucide-react';
import { askAsha } from '@/app/actions'; 
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';


const CONVERSATION_PATH_PREFIX = 'asha-conversations';
const MAX_CONTEXT_MESSAGES = 10; 

// Helper function to get the current user's ID token
const getAuthToken = async (authInstance: ReturnType<typeof getAuth>): Promise<string | null> => {
    const user = authInstance.currentUser;
    if (user) {
        // Force token refresh (true) to ensure token is valid and current
        return user.getIdToken(true); 
    }
    return null; 
};


export default function AshaAgentPage() {
    const { user, auth, firestore, isUserLoading } = useFirebase();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // --- 1. Firebase Initialization and Authentication ---
    useEffect(() => {
      if (!isUserLoading) {
        setIsAuthReady(true);
      }
    }, [isUserLoading]);


    // --- 2. Real-time Message Listener (onSnapshot) ---
    useEffect(() => {
        if (!user || !firestore || !isAuthReady) return;

        const userConversationPath = `${CONVERSATION_PATH_PREFIX}/${user.uid}/conversation`;
        const q = query(collection(firestore, userConversationPath), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as (ChatMessage & {id: string})[];
            setMessages(msgs);
        }, (error) => {
            console.error("Firestore error reading messages:", error);
        });

        return () => unsubscribe();
    }, [user, firestore, isAuthReady]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // --- 3. Server Action Interaction Function ---
    const generateResponse = async (userMessage: string) => {
        if (!auth || !firestore || !user) return;
        setIsThinking(true);
        const userConversationPath = `${CONVERSATION_PATH_PREFIX}/${user.uid}/conversation`;

        // 1. Get the Firebase ID Token
        const idToken = await getAuthToken(auth);
        
        if (!idToken) {
            setIsThinking(false);
            await addDoc(collection(firestore, userConversationPath), {
                text: "Authentication is still loading. Please wait a moment and try again.",
                role: 'model',
                timestamp: Date.now()
            });
            return;
        }

        // 2. Prepare chat history for context
        const history = messages
            .slice(-MAX_CONTEXT_MESSAGES) 
            .map(msg => ({ 
                role: msg.role, 
                text: msg.text 
            }));

        try {
            // 3. Call the Server Action
            const responseText = await askAsha(idToken, userMessage, history);
            
            // 4. Save the AI's response to Firestore
            await addDoc(collection(firestore, userConversationPath), {
                text: responseText,
                role: 'model',
                timestamp: Date.now()
            });

        } catch (error: any) {
            console.error("Server Action Error:", error);
            await addDoc(collection(firestore, userConversationPath), {
                text: `Sorry, there was a system error: ${error.message}`,
                role: 'model',
                timestamp: Date.now()
            });
        } finally {
            setIsThinking(false);
        }
    };

    // --- 4. Handle User Submission ---
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking || !user || !isAuthReady) {
          if(!isAuthReady) console.warn("Cannot send: Authentication not ready.");
          return;
        };

        const userMessage = input.trim();
        setInput('');

        // 1. Save user message immediately
        const userConversationPath = `${CONVERSATION_PATH_PREFIX}/${user.uid}/conversation`;
        await addDoc(collection(firestore, userConversationPath), {
            text: userMessage,
            role: 'user',
            timestamp: Date.now()
        });
        
        // 2. Trigger the AI response
        await generateResponse(userMessage);
    };

    // --- Component Rendering ---
    const Message = ({ text, role }: { text: string; role: 'user' | 'model' }) => (
        <div className={cn('flex items-end gap-2', role === 'user' ? 'justify-end' : 'justify-start')}>
             {role === 'model' && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback>AI</AvatarFallback>
                </Avatar>
            )}
            <div className={cn('max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2 shadow-sm', 
                role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-none' 
                    : 'bg-muted rounded-bl-none'
            )}>
                <p className="whitespace-pre-wrap text-sm">{text}</p>
            </div>
             {role === 'user' && (
                <Avatar className="h-8 w-8">
                     <AvatarFallback>
                        {user?.email?.[0].toUpperCase() || '?'}
                    </AvatarFallback>
                </Avatar>
            )}
        </div>
    );

    return (
        <div className="container mx-auto py-12 flex justify-center">
            <Card className="w-full max-w-2xl h-[70vh] flex flex-col">
                <CardHeader className="text-center">
                    <h1 className="text-2xl font-bold text-primary font-headline">🛒 Asha, Your Shopping Agent</h1>
                    <p className="text-xs text-muted-foreground">User ID: {user?.uid || 'Authenticating...'}</p>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden">
                     <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                            {messages.length === 0 && !isAuthReady && (
                                <div className="text-center text-gray-500 mt-20 p-4">
                                     <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    <p className="font-semibold">Authenticating...</p>
                                </div>
                            )}
                            {messages.length === 0 && isAuthReady && (
                                <div className="text-center text-gray-500 mt-20 p-4 border rounded-xl bg-background shadow-sm">
                                    <p className="font-semibold">Start the conversation!</p>
                                    <p className="text-sm">Try using mixed language: "I need milk and konni ullipayalu."</p>
                                </div>
                            )}
                            {messages.map((msg, index) => (
                                <Message key={index} text={(msg as any).text} role={(msg as any).role} />
                            ))}
                            
                            {isThinking && (
                                <div className="flex justify-start items-end gap-2">
                                     <Avatar className="h-8 w-8">
                                        <AvatarFallback>AI</AvatarFallback>
                                    </Avatar>
                                    <div className="px-4 py-3 max-w-xs rounded-lg bg-muted text-muted-foreground rounded-bl-none shadow-sm flex items-center space-x-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Asha is thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter>
                     <form onSubmit={handleSend} className="flex w-full space-x-2">
                        <Input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isAuthReady ? "Ask Asha about your groceries..." : "Authenticating..."}
                            disabled={!user || isThinking || !isAuthReady}
                        />
                        <Button
                            type="submit"
                            disabled={!user || isThinking || !isAuthReady}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={true}
                        >
                            <Mic className="w-4 h-4" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
};
