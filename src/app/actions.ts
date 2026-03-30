sage); 
  }
}

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, MenuItem, CartItem, Booking, EmployeeProfile, AttendanceRecord, SiteConfig, OrderItem, User } from '@/lib/types';
import { format, addMinutes, isAfter, parse, startOfDay, setHours, setMinutes } from 'date-fns';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

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
      identity: (app.options as any).credential?.client_email || 'Service Account Connected',
      counts: { users: usersCount.data().count, stores: storesCount.data().count }
    };
  } catch (error: any) {
    return { 
        status: 'error', 
        serverDbStatus: 'Unavailable',
        errorMessage: error.message,
        counts: { users: 0, stores: 0 } 
    };
  }
}

export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te' }) {
    return getIngredientsForDishFlow(input);
}

export async function sendChatNotification(recipientId: string, senderName: string, message: string) {
    try {
        const { db, messaging } = await getAdminServices();
        const userDoc = await db.collection('users').doc(recipientId).get();
        const fcmToken = userDoc.data()?.fcmToken;

        if (!fcmToken) return { success: false, error: 'No FCM token for user' };

        await messaging.send({
            token: fcmToken,
            notification: {
                title: senderName,
                body: message,
            },
            data: {
                click_action: '/chat',
                type: 'chat_message'
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'chat_messages'
                }
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("FCM Send Error:", error);
        return { success: false, error: error.message };
    }
}

export async function sendBroadcastNotification(title: string, body: string) {
    try {
        const { db, messaging } = await getAdminServices();
        
        const usersSnap = await db.collection('users').where('fcmToken', '!=', '').get();
        const tokens = usersSnap.docs.map(doc => doc.data().fcmToken).filter(Boolean);

        if (tokens.length === 0) {
            return { success: true, results: { totalTokens: 0, successCount: 0, failureCount: 0 } };
        }

        const message = {
            notification: { title, body },
            tokens: tokens,
        };

        const response = await (messaging as any).sendEachForMulticast(message);
        return {
            success: true,
            results: {
                totalTokens: tokens.length,
                successCount: response.successCount,
                failureCount: response.failureCount,
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createBooking(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
    try {
        const { db } = await getAdminServices();
        
        if (!data.userId || data.userId === 'guest') {
            throw new Error('Authentication required to book a service.');
        }

        const dateStr = String(data.date || format(new Date(), 'yyyy-MM-dd'));
        const timeStr = String(data.time || '10:00');
        const cleanTime = timeStr.replace(':', '');
        
        const bookingId = `${data.storeId}_${dateStr}_${cleanTime}_${Math.random().toString(36).substring(7)}`;
        const bookingRef = db.collection('bookings').doc(bookingId);

        const result = await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(bookingRef);
            if (snap.exists && snap.data()?.status !== 'Cancelled') {
                throw new Error('This slot has just been taken. Please choose another time.');
            }

            const bookingData = {
                id: bookingId,
                storeId: data.storeId,
                userId: data.userId,
                deviceId: data.deviceId || 'unknown',
                serviceId: data.serviceId,
                serviceName: data.serviceName,
                price: data.price,
                duration: data.duration,
                customerName: data.customerName,
                phone: data.phone,
                notes: data.notes || '',
                date: dateStr,
                time: timeStr,
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
        
        const startHourStr = storeData?.workingHours?.start || '10:00';
        const endHourStr = storeData?.workingHours?.end || '20:00';
        
        const startHour = parseInt(startHourStr.split(':')[0]) || 10;
        const startMin = parseInt(startHourStr.split(':')[1] || '0') || 0;
        const endHour = parseInt(endHourStr.split(':')[0]) || 20;
        const endMin = parseInt(endHourStr.split(':')[1] || '0') || 0;

        const bookingsSnap = await db.collection('bookings')
            .where('storeId', '==', storeId)
            .where('date', '==', date)
            .where('status', '!=', 'Cancelled')
            .get();
        
        const bookedTimes = new Set(bookingsSnap.docs.map(doc => doc.data().time));

        const slots = [];
        const baseDate = parse(date, 'yyyy-MM-dd', new Date());
        const startTime = setHours(setMinutes(startOfDay(baseDate), startMin), startHour);
        const endTime = setHours(setMinutes(startOfDay(baseDate), endMin), endHour);
        
        let current = startTime;
        const now = new Date();
        const interval = Math.max(15, duration || 30);

        while (current < endTime) {
            const timeStr = format(current, 'HH:mm');
            const isBooked = bookedTimes.has(timeStr);
            const isPast = isAfter(now, current);

            slots.push({
                time: timeStr,
                label: format(current, 'hh:mm a'),
                available: !isBooked && !isPast
            });

            current = addMinutes(current, interval);
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

export async function getPlatformAnalytics() {
    try {
        const { db, app } = await getAdminServices();
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
            projectId: app.options.projectId,
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

export async function getSiteConfig(configId: string): Promise<SiteConfig | null> {
    try {
        const { db } = await getAdminServices();
        const docSnap = await db.collection('siteConfig').doc(configId).get();
        return docSnap.exists ? docSnap.data() as SiteConfig : null;
    } catch (error) {
        return null;
    }
}

export async function updateSiteConfig(configId: string, data: Partial<SiteConfig>) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(configId).set(data, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        const batch = db.batch();

        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phone,
            address: data.address,
        });

        const profileRef = db.collection('employeeProfiles').doc(userId);
        batch.update(profileRef, {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            address: data.address,
            role: data.role,
            salaryRate: data.salaryRate,
            salaryType: data.salaryType,
            payoutMethod: data.payoutMethod,
            upiId: data.upiId || null,
            reportingTo: data.reportingTo || null,
            bankDetails: data.payoutMethod === 'bank' ? {
                accountHolderName: data.accountHolderName,
                accountNumber: data.accountNumber,
                ifscCode: data.ifscCode,
            } : null,
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function approveRegularization(recordId: string, storeId: string, isApproved: boolean) {
    try {
        const { db } = await getAdminServices();
        const recordRef = db.collection(`stores/${storeId}/attendance`).doc(recordId);
        
        await recordRef.update({
            status: isApproved ? 'approved' : 'rejected',
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectRegularization(recordId: string, storeId: string, reason: string) {
    try {
        const { db } = await getAdminServices();
        const recordRef = db.collection(`stores/${storeId}/attendance`).doc(recordId);
        
        await recordRef.update({
            status: 'rejected',
            rejectionReason: reason,
            rejectionCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getStoreSalesReport({ storeId, period }: { storeId: string, period: 'daily' | 'weekly' | 'monthly' }) {
    try {
        const { db } = await getAdminServices();
        const now = new Date();
        let startDate: Date;

        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'weekly') {
            const firstDay = now.getDate() - now.getDay();
            startDate = new Date(now.setDate(firstDay));
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const startTimestamp = Timestamp.fromDate(startDate);
        const ordersSnap = await db.collection('orders')
            .where('storeId', '==', storeId)
            .where('status', 'in', ['Delivered', 'Completed', 'Billed'])
            .where('orderDate', '>=', startTimestamp)
            .get();

        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        let totalSales = 0;
        const topProductsMap = new Map<string, number>();

        orders.forEach(order => {
            totalSales += order.totalAmount;
            (order.items || []).forEach(item => {
                const count = topProductsMap.get(item.productName) || 0;
                topProductsMap.set(item.productName, count + item.quantity);
            });
        });

        const topProducts = Array.from(topProductsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        return {
            success: true,
            report: {
                totalSales,
                totalOrders: orders.length,
                topProducts,
                ingredientCost: totalSales * 0.45, 
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addRestaurantOrderItem({ storeId, sessionId, tableNumber, item, quantity }: { storeId: string, sessionId: string, tableNumber: string | null, item: MenuItem, quantity: number }) {
    try {
        const { db } = await getAdminServices();
        const orderId = `${storeId}_${sessionId}`;
        const orderRef = db.collection('orders').doc(orderId);

        const orderItem: OrderItem = {
            id: crypto.randomUUID(),
            orderId,
            productId: item.id,
            menuItemId: item.id,
            productName: item.name,
            variantSku: `${item.id}-default`,
            variantWeight: '1 pc',
            quantity,
            price: item.price,
        };

        await orderRef.set({
            id: orderId,
            storeId,
            sessionId,
            tableNumber,
            status: 'Pending',
            isActive: true,
            orderDate: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            items: FieldValue.arrayUnion(orderItem),
            totalAmount: FieldValue.increment(item.price * quantity),
            userId: 'guest', 
            orderType: 'dine-in',
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function placeRestaurantOrder(cartItems: CartItem[], total: number, guestInfo: any, idToken: string, sessionId?: string, deviceId?: string) {
    try {
        const { db } = await getAdminServices();
        const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const orderRef = db.collection('orders').doc(orderId);

        const orderData = {
            id: orderId,
            items: cartItems.map(item => ({
                id: crypto.randomUUID(),
                productId: item.product.id,
                productName: item.product.name,
                variantSku: item.variant.sku,
                variantWeight: item.variant.weight,
                quantity: item.quantity,
                price: item.variant.price
            })),
            totalAmount: total,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            status: 'Pending',
            isActive: true,
            orderDate: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            storeId: cartItems[0]?.product.storeId,
            userId: 'guest', 
            sessionId: sessionId || `session-${Date.now()}`,
            deviceId: deviceId || null,
            orderType: 'takeaway'
        };

        await orderRef.set(orderData);
        return { success: true, orderId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function uploadStoreImage(storeId: string, base64Image: string) {
    try {
        const { storage, db } = await getAdminServices();
        const bucket = storage.bucket();
        const fileName = `stores/${storeId}/logo-${Date.now()}.jpg`;
        const file = bucket.file(fileName);

        const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        
        await file.save(buffer, {
            metadata: { contentType: 'image/jpeg' },
            public: true
        });

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        
        await db.collection('stores').doc(storeId).update({
            imageUrl: publicUrl,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, imageUrl: publicUrl };
    } catch (error: any) {
        return { success: false, error: error.message };
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
  } catch (error: any) { 
    throw new Error(error.mes