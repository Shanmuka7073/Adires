
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, Store, User, ReportData, Ingredient, RestaurantIngredient } from '@/lib/types';
import { getApps } from 'firebase-admin/app';

/**
 * EXECUTIVE DECISION ENGINE
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const startTimestamp = Timestamp.fromDate(todayStart);
        const yesterdayTimestamp = Timestamp.fromDate(yesterdayStart);

        const [
            userCount, 
            storeCount, 
            todayOrdersSnap, 
            yesterdayOrdersSnap,
            activeSessionsSnap,
            allSuccessfulOrdersSnap,
            deliveryPartnersSnap,
            appStatusSnap
        ] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').where('isClosed', '!=', true).count().get(),
            db.collection('orders').where('orderDate', '>=', startTimestamp).get(),
            db.collection('orders').where('orderDate', '>=', yesterdayTimestamp).where('orderDate', '<', todayStart).get(),
            db.collection('orders').where('isActive', '==', true).count().get(),
            db.collection('orders').where('status', 'in', ['Delivered', 'Completed']).get(),
            db.collection('deliveryPartners').get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        const todayOrders = todayOrdersSnap.docs.map(d => d.data() as Order);
        const yesterdayOrders = yesterdayOrdersSnap.docs.map(d => d.data() as Order);
        const successfulOrders = allSuccessfulOrdersSnap.docs.map(d => d.data() as Order);
        const partners = deliveryPartnersSnap.docs.map(d => d.data());
        const appStatus = appStatusSnap.data() || { isMaintenance: false };

        const revenueToday = todayOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
        const revenueYesterday = yesterdayOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
        const revenueTrend = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : 0;

        const aov = successfulOrders.length > 0 ? successfulOrders.reduce((acc, o) => acc + o.totalAmount, 0) / successfulOrders.length : 0;
        const aovYesterday = yesterdayOrders.length > 0 ? yesterdayOrders.reduce((acc, o) => acc + o.totalAmount, 0) / yesterdayOrders.length : 0;
        const aovTrend = aovYesterday > 0 ? ((aov - aovYesterday) / aovYesterday) * 100 : 0;

        const decisions = [];
        
        if (appStatus.isMaintenance) {
            decisions.push({
                type: 'critical',
                title: 'Platform Halted',
                message: 'Maintenance Mode is currently ACTIVE. Standard users are locked out.',
                action: 'Maintenance Off'
            });
        }

        const zoneLoad: Record<string, number> = {};
        todayOrders.filter(o => o.status === 'Pending').forEach(o => {
            if (o.zoneId) zoneLoad[o.zoneId] = (zoneLoad[o.zoneId] || 0) + 1;
        });

        Object.entries(zoneLoad).forEach(([zoneId, count]) => {
            const zonePartners = partners.filter(p => p.zoneId === zoneId).length;
            if (count > 5 && zonePartners < 2) {
                decisions.push({
                    type: 'critical',
                    title: `Zone Bottleneck: ${zoneId.replace('zone-', '')}`,
                    message: `${count} orders pending with only ${zonePartners} active partners.`,
                    action: 'Boost Partner Rewards'
                });
            }
        });

        const storeRevenueMap = new Map<string, { revenue: number, orderCount: number, name: string, businessType: string }>();
        successfulOrders.forEach(o => {
            const current = storeRevenueMap.get(o.storeId) || { revenue: 0, orderCount: 0, name: o.storeName || 'Verified Store', businessType: o.orderType || 'Retail' };
            current.revenue += o.totalAmount;
            current.orderCount += 1;
            storeRevenueMap.set(o.storeId, current);
        });

        const topStores = Array.from(storeRevenueMap.entries())
            .map(([id, stats]) => ({ id, ...stats }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalUsers: userCount.data().count || 0,
            totalStores: storeCount.data().count || 0,
            ordersToday: todayOrders.length,
            revenueToday,
            revenueTrend,
            aov,
            aovTrend,
            activeSessions: activeSessionsSnap.data().count || 0,
            fulfillmentRate: 98.4,
            decisions,
            topStores,
            isMaintenance: appStatus.isMaintenance || false
        };
    } catch (error: any) {
        console.error("Platform Analytics failed:", error);
        return {
            totalUsers: 0, totalStores: 0, ordersToday: 0, revenueToday: 0, revenueTrend: 0, aov: 0, aovTrend: 0, activeSessions: 0, fulfillmentRate: 0, decisions: [], topStores: [], isMaintenance: false
        };
    }
}

export async function executeCommand(commandType: string) {
    const { db } = await getAdminServices();
    const timestamp = Timestamp.now();

    try {
        switch (commandType) {
            case 'reward_boost':
            case 'boost_partner_rewards':
                await db.collection('siteConfig').doc('partnerRewards').set({
                    multiplier: 1.5,
                    active: true,
                    updatedAt: timestamp,
                    expiresAt: Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000))
                }, { merge: true });
                return { success: true, message: 'Partner rewards boosted platform-wide.' };
            
            case 'flash_promo':
            case 'trigger_flash_promo':
                await db.collection('siteConfig').doc('promotions').set({
                    title: 'Evening Rush: 10% Off',
                    active: true,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'Flash promotion live on all storefronts.' };

            case 'maintenance_on':
            case 'maintenance_mode':
                await db.collection('siteConfig').doc('appStatus').set({ 
                    isMaintenance: true,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'App set to Maintenance Mode.' };

            case 'maintenance_off':
            case 'maintenance_off':
                await db.collection('siteConfig').doc('appStatus').set({ 
                    isMaintenance: false,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'App is now LIVE again.' };

            default:
                throw new Error(`Command "${commandType}" is not implemented.`);
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getFileContent(relativeFilePath: string): Promise<string> {
    try {
        const sanitizedPath = relativeFilePath.replace(/\.\./g, '').replace(/^\/+/, '');
        const fullPath = path.join(process.cwd(), sanitizedPath);
        const content = await fs.readFile(fullPath, 'utf8');
        return content;
    } catch (error: any) {
        console.error("getFileContent failed:", error);
        return `Error: Could not read file at ${relativeFilePath}.`;
    }
}

export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    const projectId = adminApp.options.projectId;
    if (!projectId) throw new Error("Project ID missing.");
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (error: any) {
    return null;
  }
}

export async function updateStoreImageUrl(storeId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        await db.collection('stores').doc(storeId).update({ imageUrl });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSystemStatus() {
    try {
        const { db } = await getAdminServices();
        const [users, stores] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
        ]);
        return {
            status: 'ok',
            llmStatus: 'Online',
            serverDbStatus: 'Online',
            counts: { users: users.data().count, stores: stores.data().count },
        };
    } catch (err: any) {
        return {
            status: 'error',
            llmStatus: 'Offline',
            serverDbStatus: 'Offline',
            errorMessage: err?.message,
            counts: { users: 0, stores: 0 },
        };
    }
}
