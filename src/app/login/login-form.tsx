/* eslint-disable react/no-unescaped-entities */
'use client';

import { useSearchParams } from 'next/navigation';
import { NonBlockingLogin } from '@/firebase/non-blocking-login';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <>
      {error && (
        <div className="bg-red-500 text-white p-4 rounded-md mb-4">
          <p className="text-center font-bold">Login Failed</p>
          <p className="text-center">{error}</p>
        </div>
      )}
      <NonBlockingLogin />
    </>
  );
}
