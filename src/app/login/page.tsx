'use client';

import LoginForm from './login-form';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * AUTHENTICATION HUB
 * Redirection logic is centralized in AuthGuard to prevent race conditions.
 */
export default function LoginPage() {
  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4 bg-[#FDFCF7]">
      <Suspense fallback={<Loader2 className="animate-spin h-8 w-8 opacity-20" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
