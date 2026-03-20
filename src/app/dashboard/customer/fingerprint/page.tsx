import { redirect } from 'next/navigation';

/**
 * FINGERPRINT REGISTRATION PAGE (REMOVED)
 * Biometric functionality has been disabled.
 */
export default function FingerprintRemovedPage() {
    redirect('/dashboard/customer/my-profile');
    return null;
}
