
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, ReportData, MenuItem, CartItem, Booking, SiteConfig } from '@/lib/types';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';
import { format, addMinutes, isAfter, parse } from 'date-fns';

/**
 * DEEP SERIALIZATION UTILITY
 */
function sanitizeForClient(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data === 'object' && 'seconds' in data && 'nanoseconds' in data) {
        return new Date(data.seconds * 1000).toISOString();
    }
    if (data instanceof Date) return data.toISOString();
    if (Array.isArray(data)) return data.map(sanitizeForClient);
    if (typeof data === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(data)) {
            cleaned[key] = sanitizeForClient(value);
        }
        return cleaned;
    }
    return data;
}

export async function getFirebaseConfig() {
  try {
    const { app } = await getAdminServices();
    const options = app.options as any;
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: options.authDomain || `${options.projectId}.firebaseapp.com`,
      projectId: options.projectId,
      storageBucket: options.storageBucket || `${options.projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    };
  } catch (e) { return null; }
}

export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTodayTs = Timestamp.fromDate(startOfToday);

        const [usersCount, storesCount, ordersCountSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders')
                .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
                .where('orderDate', '>=', startOfTodayTs)
                .count().get(),
        ]);

        let todayRevenue = 0;
        const ordersSnap = await db.collection('orders')
            .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
            .where('orderDate', '>=', startOfTodayTs)
            .limit(100)
            .get();

        ordersSnap.docs.forEach(doc => { 
            todayRevenue += (doc.data().totalAmount || 0); 
        });

        return sanitizeForClient({
            totalUsers: usersCount.data().count,
            totalStores: storesCount.data().count,
            activeSessions: ordersCountSnap.data().count,
            periods: {
                today: {
                    revenue: todayRevenue,
                    orders: ordersCountSnap.data().count,
                    aov: ordersCountSnap.data().count > 0 ? todayRevenue / ordersCountSnap.data().count : 0,
                }
            }
        });
    } catch (error) { 
        return null; 
    }
}

export async function getSystemStatus() {
  try {
    const { db, app } = await getAdminServices();
    const [usersCount, storesCount] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('stores').count().get()
    ]);
    
    return {
      status: 'ok',
      llmStatus: 'Online',
      serverDbStatus: 'Online',
      projectId: app.options.projectId || 'Unknown',
      identity: (app.options as any).credential?.clientEmail || 'Service Account Active',
      counts: { users: usersCount.data().count, stores: storesCount.data().count }
    };
  } catch (error: any) {
    return { 
        status: 'error', 
        errorMessage: error.message,
        counts: { users: 0, stores: 0 } 
    };
  }
}

export async function updateSiteConfig(id: string, config: Partial<SiteConfig>) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(id).set(config, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSiteConfig(id: string): Promise<SiteConfig | null> {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc(id).get();
        return snap.exists ? snap.data() as SiteConfig : null;
    } catch (e) {
        return null;
    }
}

export async function createBooking(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
    try {
        const { db } = await getAdminServices();
        const bookingId = `${data.storeId}_${data.date}_${data.time?.replace(':', '') || '0000'}`;
        const bookingRef = db.collection('bookings').doc(bookingId);

        const result = await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(bookingRef);
            if (snap.exists && snap.data()?.status !== 'Cancelled') {
                throw new Error('This slot has just been taken. Please choose another time.');
            }

            const bookingData = {
                ...data,
                id: bookingId,
                status: 'Booked',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            transaction.set(bookingRef, bookingData);
            return bookingId;
        });

        return { success: true, bookingId: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAvailableSlots(storeId: string, date: string, duration: number) {
    try {
        const { db } = await getAdminServices();
        const storeSnap = await db.collection('stores').doc(storeId).get();
        const storeData = storeSnap.data();
        
        const startHour = parseInt(storeData?.workingHours?.start?.split(':')[0] || '10');
        const endHour = parseInt(storeData?.workingHours?.end?.split(':')[0] || '20');

        const bookingsSnap = await db.collection('bookings')
            .where('storeId', '==', storeId)
            .where('date', '==', date)
            .where('status', '!=', 'Cancelled')
            .get();
        
        const bookedTimes = new Set(bookingsSnap.docs.map(doc => doc.data().time));

        const slots = [];
        let current = parse(`${date} ${startHour}:00`, 'yyyy-MM-dd H:mm', new Date());
        const end = parse(`${date} ${endHour}:00`, 'yyyy-MM-dd H:mm', new Date());
        const now = new Date();

        while (current < end) {
            const timeStr = format(current, 'HH:mm');
            const isBooked = bookedTimes.has(timeStr);
            const isPast = isAfter(now, current);

            slots.push({
                time: timeStr,
                label: format(current, 'hh:mm a'),
                available: !isBooked && !isPast
            });

            current = addMinutes(current, duration || 30);
        }

        return { success: true, slots };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBookingStatus(bookingId: string, status: Booking['status']) {
    try {
        const { db } = await getAdminServices();
        await db.collection('bookings').doc(bookingId).update({
            status,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getIngredientsForDish({ dishName, language }: { dishName: string; language: 'en' | 'te' }) {
    try {
        const result = await getIngredientsForDishFlow({ dishName, language });
        return sanitizeForClient(result);
    } catch (error) { 
        return { isSuccess: false, title: dishName, components: [], steps: [], itemType: 'product' };
    }
}

export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
  try {
    const { db } = await getAdminServices();
    const slipDocActual = await db.collection("stores").doc(storeId!).collection("salarySlips").doc(slipId).get();
    if (!slipDocActual.exists) return null;
    const slip = slipDocActual.data();
    const empDoc = await db.collection('employeeProfiles').doc(userId).get();
    const userDoc = await db.collection('users').doc(userId).get();
    return sanitizeForClient({ slip, employee: { ...empDoc.data(), ...userDoc.data() }, attendance: slip?.attendance || {} });
  } catch (error: any) { throw new Error(error.message); }
}
