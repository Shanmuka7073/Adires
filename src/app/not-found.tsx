import Link from 'next/link';
import { Frown } from 'lucide-react';

/**
 * Custom 404 Not Found Page.
 * This component is automatically rendered by Next.js whenever a user navigates to an undefined route.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-6">
      <div className="text-center bg-white p-10 rounded-xl shadow-2xl max-w-lg w-full">
        
        <Frown className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-bounce-slow" />

        <h1 className="text-7xl font-extrabold text-gray-900 mb-2">
          404
        </h1>
        
        <h2 className="text-3xl font-semibold text-gray-700 mb-4">
          Page Not Found
        </h2>
        
        <p className="text-lg text-gray-500 mb-8">
          Oops! The artifact you were looking for doesn't exist or has been moved.
        </p>

        <Link 
          href="/" 
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 transition duration-300 transform hover:scale-105"
        >
          Go Back to Home
        </Link>
      </div>

      <style jsx global>{`
        /* Custom animation for a gentle bounce */
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(-5%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s infinite;
        }
      `}</style>
    </div>
  );
}
