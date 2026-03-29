
'use client';

import { useSearchParams } from 'next/navigation';
import { NonBlockingLogin } from '@/firebase/non-blocking-login';

/**
 * Wrapper for the NonBlockingLogin component to handle URL-based errors and redirection context.
 */
export default function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const redirectTo = searchParams.get('redirectTo');

  return (
    <div className="w-full flex flex-col items-center">
      {error && (
        <div className="w-full max-w-md bg-destructive text-destructive-foreground p-4 rounded-2xl mb-6 shadow-lg animate-in fade-in slide-in-from-top-2">
          <p className="text-center font-black uppercase text-xs tracking-widest">System Error</p>
          <p className="text-center text-sm font-medium mt-1">{error}</p>
        </div>
      )}
      <NonBlockingLogin redirectTo={redirectTo || undefined} />
    </div>
  );
}
