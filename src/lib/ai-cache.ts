
'use client';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedAIResponse } from './types';

export async function getCachedAIResponse(db: Firestore, question: string): Promise<string | null> {
    // AI features removed, always return null
    return null;
}

export async function cacheAIResponse(db: Firestore, question: string, answer: string): Promise<void> {
    // AI features removed, do nothing
    return;
}
