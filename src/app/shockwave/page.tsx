'use client';
import React, { useState, useCallback } from 'react';
import { ShoppingBag, MapPin, Star, Truck, Code, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Data for the four stores
const stores = [
  { id: '1', name: 'Chandra Mart', type: 'Supermarket', distance: '0.1 km', icon: ShoppingBag, color: 'bg-red-500', location: 'Kurnool, AP' },
  { id: '2', name: 'Green Basket', type: 'Fresh Produce', distance: '0.5 km', icon: Star, color: 'bg-green-500', location: 'Kurnool, AP' },
  { id: '3', name: 'Quick Pharma', type: 'Pharmacy', distance: '1.2 km', icon: Truck, color: 'bg-blue-500', location: 'Kurnool, AP' },
  { id: '4', name: 'Tech Spot', type: 'Electronics', distance: '2.5 km', icon: Code, color: 'bg-purple-500', location: 'Kurnool, AP' },
];

// Utility function to generate the shockwave class
const getSelectedClass = (id: string, selectedId: string | null, selectedStore: any) => {
  if (selectedId !== id || !selectedStore) return '';
  
  // This class triggers the shockwave/pulse animation
  return `ring-4 ring-offset-4 ${selectedStore.color.replace('bg-', 'ring-')} animate-shockwave shadow-2xl shadow-${selectedStore.color.replace('bg-', '')}-500/70`;
};

// Main App Component
const ShockwaveDemoPage = () => {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [speechOutput, setSpeechOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Function to simulate the high-speed, autonomous learning check
  const handleSelectStore = useCallback((storeName: string) => {
    setIsLoading(true);
    setSpeechOutput('');

    // Simulate the ultra-fast database lookup and AI correction (as discussed)
    // The 300ms delay simulates the network time to check the database or call Gemini Flash
    setTimeout(() => {
      const store = stores.find(s => s.name.toLowerCase().includes(storeName.toLowerCase()));

      if (store) {
        setSelectedStoreId(store.id);
        setSelectedStore(store);
        setSpeechOutput(`Excellent! Selected ${store.name}. Instant learning complete.`);

        // Clear the animation after a short delay (1.5s)
        setTimeout(() => {
          setSelectedStoreId(null);
          setSelectedStore(null);
        }, 1500); 

      } else {
        setSpeechOutput(`Store for "${storeName}" not found. Triggering asynchronous self-learning...`);
        setSelectedStoreId(null);
        setSelectedStore(null);
      }
      setIsLoading(false);
    }, 300); 

  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans antialiased overflow-x-hidden">
      <style jsx global>{`
        /* --- Shockwave Animation --- */
        @keyframes shockwave {
          0% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0px 0px rgba(0, 0, 0, 0.2);
          }
          50% {
            transform: scale(1.03);
            opacity: 1;
            box-shadow: 0 0 30px 5px var(--ring-color); 
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-shockwave {
          animation: shockwave 1.5s ease-out;
        }

        /* Hide scrollbar for cleaner mobile look */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
      `}</style>

      {/* Header and Voice Input */}
      <div className="w-full max-w-4xl mb-6 p-4 bg-white rounded-xl shadow-lg border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <Mic className="w-6 h-6 mr-2 text-indigo-600" />
          Autonomous Store Selection
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter a store name to simulate the instant, self-correcting voice command.
        </p>

        {/* Mock Voice Input Field */}
        <div className="flex space-x-2">
            <Input
                type="text"
                placeholder="E.g., 'Chandra Mart' or a misspelling like 'Quick Pharmo'"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelectStore(e.currentTarget.value);
                }}
                disabled={isLoading}
                className="flex-grow rounded-lg"
            />
            <Button 
                onClick={(e) => handleSelectStore((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition duration-150"
            >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Shock!'}
            </Button>
        </div>

        {/* Speech Output/Status Box */}
        {speechOutput && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-sm transition-opacity duration-300">
                Status: **{speechOutput}**
            </div>
        )}
      </div>

      {/* --- Horizontal Store Display --- */}
      <div className="w-full max-w-4xl overflow-x-auto no-scrollbar py-2">
        <div className="flex space-x-4 pb-2"> {/* pb-2 gives space for the shadow/ring */}
          {stores.map((store) => (
            <div
              key={store.id}
              className={`
                flex-none w-60 bg-white p-4 rounded-xl shadow-lg 
                transition-all duration-300 transform 
                cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.98]
                ${getSelectedClass(store.id, selectedStoreId, selectedStore)}
              `}
              onClick={() => handleSelectStore(store.name)}
              style={
                // Set CSS variable for dynamic ring color based on the selected store's color
                selectedStore && selectedStore.id === store.id 
                ? { '--ring-color': (store.color.replace('bg-', '#') + '50') as any }
                : {}
              }
            >
              <div className="flex items-start justify-between mb-3">
                {/* Store Icon */}
                <div className={`p-2 rounded-full text-white ${store.color} shadow-md`}>
                  <store.icon className="w-5 h-5" />
                </div>
                {/* Distance Badge */}
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                  {store.distance} Away
                </span>
              </div>
              
              {/* Store Details */}
              <h2 className="text-lg font-bold text-gray-900 truncate">{store.name}</h2>
              <p className="text-sm text-gray-500 mb-2">{store.type}</p>
              
              <div className="flex items-center text-xs text-gray-600">
                <MapPin className="w-3 h-3 mr-1 text-red-500" />
                {store.location}
              </div>

              {/* Action Button */}
              <Button 
                size="sm"
                className="mt-3 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg transition duration-150"
              >
                Visit Store &rarr;
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShockwaveDemoPage;
