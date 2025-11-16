
'use client';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe } from './types';

export async function getCachedRecipe(db: Firestore, dishName: string): Promise<string[] | null> {
    // AI features removed, so this will always return null.
    return null;
}

export async function cacheRecipe(db: Firestore, dishName: string, ingredients: string[]): Promise<void> {
    // AI features removed, so this function does nothing.
    return;
}
