
/**
 * FIREBASE MESSAGING SERVICE WORKER
 * This file is required for background push notifications.
 * Note: Config values are usually hardcoded or served via a dynamic route.
 * For now, this serves as a placeholder to prevent registration errors.
 */

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-sw.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-sw.js');

// The browser will look for this file. 
// If using getToken({ serviceWorkerRegistration }), this worker stays idle
// while the main sw.js handles the logic.
console.log('FCM Placeholder Worker Loaded');
