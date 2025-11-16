
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useFirebase } from '@/firebase';
import { Send, User, Bug, Loader2 } from 'lucide-react';

const DEBUG_PATH_PREFIX = `/asha-conversations/`;

const App = () => {
    const { user, isUserLoading, firestore, auth } = useFirebase();
    const [reports, setReports] = useState([]);
    const [input, setInput] = useState('Run a system diagnostic check.');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef(null);
    
    // --- Real-time Report Listener (onSnapshot) ---
    useEffect(() => {
        if (!user || !firestore || isUserLoading) return;

        const userReportsPath = `${DEBUG_PATH_PREFIX}${user.uid}/conversation`;
        const q = query(collection(firestore, userReportsPath), orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReports(msgs);
        }, (error) => {
            console.error("Firestore error reading reports:", error);
        });

        return () => unsubscribe();
    }, [user, firestore, isUserLoading]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [reports]);

    // --- Server Action Interaction Function ---
    const runAtlasDiagnostic = async (userMessage: string) => {
        if (!user || !firestore || !auth) return;
        setIsThinking(true);
        const userReportsPath = `${DEBUG_PATH_PREFIX}${user.uid}/conversation`;
        
        // 1. Save user's intention
        await addDoc(collection(firestore, userReportsPath), {
            text: userMessage,
            role: 'user',
            timestamp: serverTimestamp()
        });

        try {
            const idToken = await user.getIdToken();

            // Use fetch to call the Server Action endpoint with auth headers.
            // Next.js automatically creates an endpoint for the server action.
            const response = await fetch('/api/actions/debugAtlasAction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify([userMessage, 'Diagnostic Check']),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server action failed');
            }
            
            const debugReport = await response.json();

            // Success: Save the Atlas report
            await addDoc(collection(firestore, userReportsPath), {
                report: debugReport.report,
                fixInstructions: debugReport.fixInstructions,
                role: 'atlas',
                timestamp: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Atlas Server Action Error:", error);
            await addDoc(collection(firestore, userReportsPath), {
                report: `Critical failure calling Atlas: ${error.message}`,
                fixInstructions: `The 'debugAtlasAction' Server Action failed to execute. Check 'src/app/actions.ts' and your Genkit setup.`,
                role: 'atlas',
                timestamp: serverTimestamp()
            });
        }
        setIsThinking(false);
    };

    // --- Handle User Submission ---
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking || !user) {
            return;
        }

        const userMessage = input.trim();
        setInput('');
        
        await runAtlasDiagnostic(userMessage);
    };

    // --- Component Rendering ---
    const ReportMessage = ({ reportData }: { reportData: any }) => {
        if (reportData.role === 'user') {
            return (
                <div className="flex w-full mt-2 justify-end">
                    <div className="p-3 max-w-xs rounded-lg shadow-md bg-indigo-600 text-white rounded-br-none flex items-start space-x-2">
                        <User className="w-4 h-4 pt-1" />
                        <p className="whitespace-pre-wrap">{reportData.text}</p>
                    </div>
                </div>
            );
        }

        // Atlas Report
        return (
            <div className="flex w-full mt-2 justify-start">
                <div className="p-4 w-full max-w-xl rounded-lg shadow-xl bg-gray-100 border-l-4 border-indigo-500 text-gray-800">
                    <div className="flex items-center mb-2 space-x-2 border-b pb-2 border-gray-300">
                        <Bug className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-lg text-indigo-700">Atlas Diagnostic Report</h3>
                    </div>
                    
                    <p className="text-sm font-semibold mb-1">Root Cause Analysis:</p>
                    <p className="text-sm mb-3 whitespace-pre-wrap">{reportData.report}</p>
                    
                    <p className="text-sm font-semibold mb-1">Fix Instructions:</p>
                    <div className="bg-white p-2 rounded text-xs border border-gray-200 whitespace-pre-wrap">
                        {reportData.fixInstructions}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="p-4 bg-white border-b shadow-sm">
                <h1 className="text-xl font-bold text-indigo-700">🛠️ Atlas: The Diagnostic Agent</h1>
                <p className="text-xs text-gray-500">User ID: {user?.uid || 'Authenticating...'}</p>
            </header>

            {/* Chat Body */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {reports.length === 0 && !isUserLoading && (
                    <div className="text-center text-gray-500 mt-20 p-4 border rounded-xl bg-white shadow-md">
                        <p className="font-semibold">Atlas is ready for diagnostics.</p>
                        <p className="text-sm">Click the send button below to run a system health check.</p>
                    </div>
                )}
                {isUserLoading && <p className="text-center text-gray-500">Loading chat...</p>}
                {reports.map((report: any) => (
                    <ReportMessage key={report.id} reportData={report} />
                ))}
                
                {/* Thinking Indicator */}
                {isThinking && (
                    <div className="flex justify-start mt-2">
                        <div className="p-3 max-w-xs rounded-lg bg-white text-gray-600 rounded-tl-none border border-gray-200 flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                            <span>Atlas is analyzing the system...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Footer */}
            <footer className="p-4 bg-white border-t">
                <form onSubmit={handleSend} className="flex space-x-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={!isUserLoading ? "Ask Atlas to check a specific part..." : "Loading authentication..."}
                        className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 transition"
                        disabled={isThinking || isUserLoading}
                    />
                    <button
                        type="submit"
                        className={`p-3 rounded-xl transition duration-150 ${
                            (isThinking || isUserLoading)
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
                        }`}
                        disabled={isThinking || isUserLoading}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default App;
