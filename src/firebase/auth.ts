'use client';

import { getAuth, Auth } from 'firebase/auth';
import { app } from './app';

/**
 * MODULAR AUTH SDK
 * Loaded independently to support fast login page rendering.
 */
export const auth: Auth = getAuth(app);
