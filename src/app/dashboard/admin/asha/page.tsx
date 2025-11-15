
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { Send, Mic, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { askAsha } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'admin@gmail.com';

const Message = ({ text, role }: { text: string, role: string }) => (
    <div className={`flex w-full mt-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`p-3 max-w-xs md:max-w-md rounded-lg shadow-md flex items-start space-x-3 ${
            role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-br-none' 
                : 'bg-card text-card-foreground rounded-tl-none border'
        }`}>
            <div className="flex-shrink-0 pt-1">
                {role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
            </div>
            <p className="whitespace-pre-wrap text-sm">{text}</p>
        </div>
    </div>
);


export default function AshaChatPage() {
    const { user, firestore, isUserLoading } = useFirebase();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const { toast } = useToast();

    // --- Admin Check ---
    useEffect(() => {
        if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
            router.replace('/dashboard');
        }
    }, [isUserLoading, user, router]);


    // --- Speech Recognition Setup ---
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = false;
            recognition.lang = 'en-IN'; // Default language
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript); // Set the transcript into the input field
                handleSend(undefined, transcript); // Automatically send after transcription
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                toast({ variant: 'destructive', title: 'Voice Error', description: `An error occurred: ${event.error}` });
                setIsListening(false);
            };
        } else {
            console.warn("Speech recognition not supported in this browser.");
        }
    }, [toast]);

    const handleMicClick = () => {
        if (!recognitionRef.current) {
            toast({ variant: 'destructive', title: 'Voice Not Supported', description: 'Your browser does not support speech recognition.' });
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };


    // --- Real-time Message Listener (onSnapshot) ---
    useEffect(() => {
        if (!user || !firestore) return;

        const userConversationPath = `/users/${user.uid}/ashaConversation`;
        const q = query(collection(firestore, userConversationPath), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        }, (error) => {
            console.error("Firestore error reading messages:", error);
        });

        return () => unsubscribe();
    }, [user, firestore]);

    // Scroll to bottom whenever messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    // --- Handle User Submission ---
    const handleSend = async (e?: React.FormEvent<HTMLFormElement>, text?: string) => {
        e?.preventDefault();
        const messageToSend = text || input;
        if (!messageToSend.trim() || isThinking || !user || !firestore) return;

        const userMessage = messageToSend.trim();
        setInput('');
        setIsThinking(true);

        const userConversationPath = `/users/${user.uid}/ashaConversation`;
        
        // 1. Save user message immediately for a snappy UI
        await addDoc(collection(firestore, userConversationPath), {
            text: userMessage,
            role: 'user',
            timestamp: serverTimestamp()
        });
        
        // 2. Trigger the server-side AI response
        try {
            const recentMessages = messages.slice(-5).map(msg => ({ 
                role: msg.role, 
                text: msg.text 
            }));

            // The call now goes through the server action, which calls the Genkit flow.
            // The flow result is automatically saved to Firestore, triggering the onSnapshot listener.
            await askAsha({ userMessage, chatHistory: recentMessages });
            
        } catch(error) {
             console.error("Error calling askAsha action:", error);
             // Optionally save an error message to Firestore
             await addDoc(collection(firestore, userConversationPath), {
                text: "My apologies, I'm having trouble connecting. Please try again in a moment.",
                role: 'model',
                timestamp: serverTimestamp()
            });
        } finally {
            setIsThinking(false);
        }
    };

    if (isUserLoading || !user || user.email !== ADMIN_EMAIL) {
        return <div className="p-4">Loading and verifying admin access...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <header className="p-4 bg-card border-b shadow-sm z-10">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Bot /> Asha, Your Shopping Agent
                </h1>
                <p className="text-xs text-muted-foreground">A conversational AI to assist with grocery needs.</p>
            </header>

            {/* Chat Body */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-muted-foreground mt-20 p-4 border rounded-xl bg-card shadow-md">
                        <p className="font-semibold">Start the conversation!</p>
                        <p className="text-sm">Try using mixed language: "I need milk and konni ullipayalu."</p>
                    </div>
                )}

                {messages.map(msg => (
                    <Message key={msg.id} text={msg.text} role={msg.role} />
                ))}
                
                {isThinking && (
                    <div className="flex justify-start mt-2">
                        <div className="p-3 max-w-xs rounded-lg bg-card text-muted-foreground rounded-tl-none border flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span>Asha is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Footer */}
            <footer className="p-4 bg-card border-t">
                <form onSubmit={handleSend} className="flex space-x-3">
                    <Input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Asha about products, recipes, or stores..."
                        className="flex-1 p-3 rounded-xl focus:ring-primary focus:border-primary transition"
                        disabled={isThinking}
                    />
                    <Button
                        type="submit"
                        className="p-3 rounded-xl transition duration-150"
                        disabled={isThinking}
                    >
                        <Send className="w-5 h-5" />
                    </Button>
                    <Button
                        type="button"
                        className={`p-3 rounded-xl transition duration-150 ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                        disabled={isThinking}
                        onClick={handleMicClick}
                    >
                        <Mic className="w-5 h-5" />
                    </Button>
                </form>
            </footer>
        </div>
    );
};
