
/**
 * ADIRES PWA SERVICE WORKER
 * Includes Ad-Network integration and PWA caching.
 */

self.options = {
    "domain": "5gvci.com",
    "zoneId": 10790859
};
self.lary = "";

// Import Ad-Network scripts
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');

// Standard PWA listeners can go here if needed, 
// but the import above handles the ad logic.
