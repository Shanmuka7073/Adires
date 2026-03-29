
'use client';

import LoginForm from './login-form';

/**
 * AUTHENTICATION HUB
 * Redirection logic has been centralized in AuthGuard.
 * This page now only handles rendering the access terminal.
 */
export default function LoginPage() {
  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4 bg-[#FDFCF7]">
      <LoginForm />
    </div>
  );
}
