
'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Send, 
    Bot, 
    User as UserIcon, 
    Loader2, 
    MapPin, 
    CheckCircle2, 
    Camera, 
    ArrowRight,
    Utensils,
    ShoppingBag,
    Scissors,
    Settings,
    Edit3,
    Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
    id: string;
    role: 'bot' | 'user';
    text: string;
    type?: 'options' | 'location' | 'summary' | 'success';
};

type OnboardingData = {
    storeName: string;
    businessType: 'restaurant' | 'grocery' | 'salon' | '';
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    imageUrl: string;
    firstProduct: { name: string; price: number } | null;
};

const STEPS = [
    { key: 'storeName', question: "Welcome to Adires! Let's get your business live. First, what is your store or business name?" },
    { key: 'businessType', question: "What type of business are you running?" },
    { key: 'address', question: "Where is your business located? You can type the address or share your GPS location." },
    { key: 'phone', question: "What is your business phone number for orders?" },
    { key: 'imageUrl', question: "Almost there! Paste a link to your logo or storefront image (Optional)." },
    { key: 'firstProduct', question: "Final step: Let's add your first product or service. What is it called and what is the price? (e.g., Chicken Biryani - 250)" },
    { key: 'review', question: "Excellent! I've prepared your business profile. Does everything look correct?" }
];

export function OnboardingChatbot({ onComplete }: { onComplete: (storeId: string) => void }) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isTyping, setIsKitchenTyping] = useState(false);
    const [isSaving, startSave] = useTransition();
    const [formData, setFormData] = useState<OnboardingData>({
        storeName: '',
        businessType: '',
        address: '',
        latitude: 0,
        longitude: 0,
        phone: '',
        imageUrl: '',
        firstProduct: null
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // Initial message
    useEffect(() => {
        addBotMessage(STEPS[0].question);
    }, []);

    const addBotMessage = (text: string, type?: Message['type']) => {
        setIsKitchenTyping(true);
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Math.random().toString(36).substring(7),
                role: 'bot',
                text,
                type
            }]);
            setIsKitchenTyping(false);
        }, 800);
    };

    const addUserMessage = (text: string) => {
        setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role: 'user',
            text
        }]);
    };

    const handleNextStep = (answer: string) => {
        const step = STEPS[currentStepIndex];
        const nextIndex = currentStepIndex + 1;

        // Validation
        if (step.key === 'phone' && !/^\d{10}$/.test(answer.replace(/\D/g, ''))) {
            addBotMessage("Please enter a valid 10-digit phone number.");
            return;
        }

        // Logic for first product parsing
        if (step.key === 'firstProduct' && answer.toLowerCase() !== 'skip') {
            const parts = answer.split('-');
            if (parts.length < 2) {
                addBotMessage("Please follow the format: Name - Price (e.g. Burger - 150)");
                return;
            }
            setFormData(prev => ({ 
                ...prev, 
                firstProduct: { 
                    name: parts[0].trim(), 
                    price: parseFloat(parts[1].trim()) || 0 
                } 
            }));
        } else if (step.key !== 'firstProduct') {
            setFormData(prev => ({ ...prev, [step.key]: answer }));
        }

        setCurrentStepIndex(nextIndex);
        if (nextIndex < STEPS.length) {
            addBotMessage(STEPS[nextIndex].question, STEPS[nextIndex].key as Message['type']);
        }
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        addUserMessage(text);
        setInputValue('');
        handleNextStep(text);
    };

    const handleOptionSelect = (option: string) => {
        addUserMessage(option);
        handleNextStep(option.toLowerCase());
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast({ variant: 'destructive', title: "Not Supported", description: "GPS is not available." });
            return;
        }

        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            const gpsAddress = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            setFormData(prev => ({ ...prev, latitude, longitude, address: gpsAddress }));
            addUserMessage(`Current GPS Location`);
            handleNextStep(gpsAddress);
        }, () => {
            toast({ variant: 'destructive', title: "Permission Denied", description: "Please type your address." });
        });
    };

    const handleFinalSubmit = () => {
        if (!user || !firestore) return;

        startSave(async () => {
            try {
                const batch = writeBatch(firestore);
                const storeId = doc(collection(firestore, 'stores')).id;
                const storeRef = doc(firestore, 'stores', storeId);

                const storeData = {
                    id: storeId,
                    ownerId: user.uid,
                    name: formData.storeName,
                    businessType: formData.businessType || 'restaurant',
                    address: formData.address,
                    latitude: formData.latitude,
                    longitude: formData.longitude,
                    phone: formData.phone,
                    imageUrl: formData.imageUrl || 'https://placehold.co/600x400/E2E8F0/64748B?text=Store+Logo',
                    imageId: `store-${Math.floor(Math.random() * 3) + 1}`,
                    isClosed: false,
                    createdAt: serverTimestamp()
                };

                batch.set(storeRef, storeData);

                if (formData.firstProduct) {
                    const productRef = doc(collection(firestore, `stores/${storeId}/products`));
                    batch.set(productRef, {
                        ...formData.firstProduct,
                        storeId,
                        category: formData.businessType === 'restaurant' ? 'Main Course' : 'General',
                        imageId: 'cat-grocery'
                    });
                }

                await batch.commit();
                addBotMessage("🎉 Your store is live!", 'success');
                setTimeout(() => onComplete(storeId), 2000);
            } catch (error: any) {
                toast({ variant: 'destructive', title: "Creation Failed", description: error.message });
            }
        });
    };

    const renderOptions = (type: string) => {
        if (type === 'businessType') {
            return (
                <div className="flex flex-wrap gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => handleOptionSelect('Restaurant')} className="rounded-full bg-white gap-2">
                        <Utensils className="h-3 w-3" /> Restaurant
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOptionSelect('Shop')} className="rounded-full bg-white gap-2">
                        <ShoppingBag className="h-3 w-3" /> Retail Shop
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOptionSelect('Service')} className="rounded-full bg-white gap-2">
                        <Scissors className="h-3 w-3" /> Salon/Service
                    </Button>
                </div>
            );
        }
        if (type === 'address') {
            return (
                <div className="mt-2">
                    <Button variant="secondary" size="sm" onClick={handleDetectLocation} className="rounded-full bg-primary text-white gap-2">
                        <MapPin className="h-3 w-3" /> Detect My GPS Location
                    </Button>
                </div>
            );
        }
        if (type === 'review') {
            return (
                <div className="space-y-4 mt-4 p-4 bg-white/50 rounded-2xl border-2 border-dashed">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><p className="opacity-40 uppercase font-black">Business</p><p className="font-bold">{formData.storeName}</p></div>
                        <div><p className="opacity-40 uppercase font-black">Type</p><p className="font-bold capitalize">{formData.businessType}</p></div>
                        <div className="col-span-2"><p className="opacity-40 uppercase font-black">Location</p><p className="font-bold truncate">{formData.address}</p></div>
                    </div>
                    <Button onClick={handleFinalSubmit} disabled={isSaving} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirm & Go Live
                    </Button>
                    <Button variant="ghost" onClick={() => setCurrentStepIndex(0)} className="w-full text-[8px] font-black uppercase tracking-widest opacity-40">Edit Answers</Button>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-[80vh] max-w-2xl mx-auto bg-[#efeae2] rounded-[3rem] shadow-2xl overflow-hidden border-8 border-white relative">
            {/* HEADER */}
            <div className="bg-[#075e54] p-6 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/20">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="font-black tracking-tight text-lg leading-none">Adires Setup Bot</h2>
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> Online Assistant
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black opacity-40 uppercase">Progress</p>
                    <p className="font-black text-xl tracking-tighter leading-none italic">{Math.round((currentStepIndex / 6) * 100)}%</p>
                </div>
            </div>

            {/* CHAT AREA */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={cn(
                                "flex w-full",
                                msg.role === 'bot' ? "justify-start" : "justify-end"
                            )}
                        >
                            <div className={cn(
                                "max-w-[85%] p-4 rounded-2xl text-sm shadow-sm relative",
                                msg.role === 'bot' 
                                    ? "bg-white text-gray-800 rounded-tl-none" 
                                    : "bg-[#dcf8c6] text-gray-900 rounded-tr-none"
                            )}>
                                <p className="font-medium leading-relaxed">{msg.text}</p>
                                {msg.role === 'bot' && renderOptions(msg.type || '')}
                                <span className="text-[8px] font-bold opacity-30 uppercase block mt-1 text-right">
                                    {format(new Date(), 'p')}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce delay-75" />
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce delay-150" />
                        </div>
                    </div>
                )}
            </div>

            {/* INPUT AREA */}
            <div className="p-4 bg-[#f0f0f0] border-t border-black/5 shrink-0">
                <div className="flex gap-2 max-w-xl mx-auto">
                    <Input 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your answer..."
                        className="h-12 rounded-2xl bg-white border-0 shadow-sm pl-6"
                        disabled={isTyping || currentStepIndex >= STEPS.length}
                    />
                    <Button 
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isTyping || currentStepIndex >= STEPS.length}
                        className="h-12 w-12 rounded-2xl bg-[#128c7e] hover:bg-[#075e54] text-white p-0 shrink-0"
                    >
                        <Send className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
