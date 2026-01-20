// // Date-based versioning - changes daily
// const CACHE_VERSION = new Date().toISOString().split('T')[0];
// const CACHE_NAME = `indian-railways-qb-${CACHE_VERSION}`;
// const RUNTIME_CACHE = `indian-railways-runtime-${CACHE_VERSION}`;

// // Only cache static assets - NO HTML FILES
// const STATIC_CACHE_URLS = [
//   '/manifest.json',
//   '/favicon.png',
//   '/indian-railway-logo.png',
//   '/icons/icon-72x72.png',
//   '/icons/icon-96x96.png',
//   '/icons/icon-128x128.png',
//   '/icons/icon-144x144.png',
//   '/icons/icon-152x152.png',
//   '/icons/icon-192x192.png',
//   '/icons/icon-384x384.png',
//   '/icons/icon-512x512.png'
// ];

// // Install event - cache only static assets
// self.addEventListener('install', (event) => {
//   console.log('Service Worker: Installing with version', CACHE_VERSION);
  
//   event.waitUntil(
//     caches.open(CACHE_NAME)
//       .then((cache) => {
//         console.log('Service Worker: Caching static files only (no HTML)');
//         return cache.addAll(STATIC_CACHE_URLS).catch(err => {
//           console.error('Failed to cache some files:', err);
//           return Promise.resolve();
//         });
//       })
//       .then(() => {
//         console.log('Service Worker: Installation complete, skipping waiting');
//         return self.skipWaiting();
//       })
//       .catch((error) => {
//         console.error('Service Worker: Installation failed', error);
//       })
//   );
// });

// // Activate event - delete ALL old caches
// self.addEventListener('activate', (event) => {
//   console.log('Service Worker: Activating with version', CACHE_VERSION);
  
//   event.waitUntil(
//     caches.keys()
//       .then((cacheNames) => {
//         console.log('Found existing caches:', cacheNames);
        
//         // Delete ALL caches to force fresh content
//         return Promise.all(
//           cacheNames.map((cacheName) => {
//             console.log('Service Worker: Deleting cache', cacheName);
//             return caches.delete(cacheName);
//           })
//         );
//       })
//       .then(() => {
//         console.log('Service Worker: All caches cleared completely');
//         return self.clients.claim();
//       })
//       .then(() => {
//         // Notify all clients
//         return self.clients.matchAll().then(clients => {
//           clients.forEach(client => {
//             console.log('Notifying client of activation');
//             client.postMessage({
//               type: 'SW_ACTIVATED',
//               version: CACHE_VERSION
//             });
//           });
//         });
//       })
//   );
// });

// // Fetch event - NEVER cache HTML, always fetch fresh
// self.addEventListener('fetch', (event) => {
//   const url = new URL(event.request.url);
  
//   // Skip cross-origin requests
//   if (!event.request.url.startsWith(self.location.origin)) {
//     return;
//   }

//   // Skip non-http(s) requests
//   if (!url.protocol.startsWith('http')) {
//     return;
//   }

//   // Check if request is for HTML
//   const isHTMLRequest = event.request.mode === 'navigate' || 
//                         event.request.headers.get('accept')?.includes('text/html') ||
//                         url.pathname.endsWith('.html') || 
//                         url.pathname === '/' ||
//                         url.pathname.endsWith('/');

//   // For HTML pages - ALWAYS NETWORK, NEVER CACHE
//   if (isHTMLRequest) {
//     console.log('HTML Request detected - fetching fresh from network:', url.pathname);
    
//     event.respondWith(
//       fetch(event.request, { 
//         cache: 'no-store',
//         headers: new Headers({
//           'Cache-Control': 'no-cache, no-store, must-revalidate',
//           'Pragma': 'no-cache'
//         })
//       })
//       .then((response) => {
//         if (!response || response.status !== 200) {
//           console.warn('Non-200 response:', response?.status);
//           return response;
//         }
        
//         console.log('✅ Fresh HTML loaded from network:', url.pathname);
//         // DO NOT CACHE - return directly
//         return response;
//       })
//       .catch((error) => {
//         console.error('❌ Network failed for HTML:', error);
        
//         // Last resort - show offline message
//         return new Response(
//           `<!DOCTYPE html>
//           <html>
//           <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Offline - Indian Railways</title>
//             <style>
//               body { 
//                 font-family: Arial, sans-serif; 
//                 display: flex; 
//                 align-items: center; 
//                 justify-content: center; 
//                 height: 100vh; 
//                 margin: 0;
//                 background: #f5f5f5;
//                 text-align: center;
//                 padding: 20px;
//               }
//               .offline-container {
//                 background: white;
//                 padding: 40px;
//                 border-radius: 12px;
//                 box-shadow: 0 4px 20px rgba(0,0,0,0.1);
//               }
//               h1 { color: #9370DB; margin-bottom: 20px; }
//               p { color: #666; line-height: 1.6; }
//               button {
//                 background: #9370DB;
//                 color: white;
//                 border: none;
//                 padding: 12px 30px;
//                 border-radius: 25px;
//                 font-size: 16px;
//                 cursor: pointer;
//                 margin-top: 20px;
//               }
//             </style>
//           </head>
//           <body>
//             <div class="offline-container">
//               <h1>📡 You're Offline</h1>
//               <p>No internet connection detected.<br>Please check your connection and try again.</p>
//               <button onclick="location.reload()">Retry</button>
//             </div>
//           </body>
//           </html>`, 
//           { 
//             status: 503,
//             statusText: 'Service Unavailable',
//             headers: new Headers({
//               'Content-Type': 'text/html'
//             })
//           }
//         );
//       })
//     );
//     return;
//   }

//   // For static assets (images, icons, manifest) - Cache with network fallback
//   event.respondWith(
//     caches.match(event.request)
//       .then((cachedResponse) => {
//         if (cachedResponse) {
//           console.log('Serving cached asset:', url.pathname);
          
//           // Return cache but update in background
//           fetch(event.request)
//             .then((response) => {
//               if (response && response.status === 200) {
//                 caches.open(RUNTIME_CACHE).then((cache) => {
//                   cache.put(event.request, response);
//                 });
//               }
//             })
//             .catch(() => {
//               // Ignore fetch errors for background updates
//             });
          
//           return cachedResponse;
//         }

//         // Not in cache - fetch from network
//         console.log('Fetching asset from network:', url.pathname);
//         return fetch(event.request)
//           .then((response) => {
//             if (!response || response.status !== 200) {
//               return response;
//             }

//             // Cache the asset
//             const responseToCache = response.clone();
//             caches.open(RUNTIME_CACHE)
//               .then((cache) => {
//                 cache.put(event.request, responseToCache);
//               });

//             return response;
//           })
//           .catch((error) => {
//             console.error('Failed to fetch asset:', url.pathname, error);
//             return new Response('Asset not available offline', { status: 503 });
//           });
//       })
//   );
// });

// // Background sync
// self.addEventListener('sync', (event) => {
//   console.log('Service Worker: Background sync triggered', event.tag);
  
//   if (event.tag === 'sync-questions') {
//     event.waitUntil(syncQuestionPapers());
//   }
// });

// async function syncQuestionPapers() {
//   try {
//     console.log('Syncing question papers...');
//     return Promise.resolve();
//   } catch (error) {
//     console.error('Sync failed:', error);
//     return Promise.reject(error);
//   }
// }

// // Push notifications
// self.addEventListener('push', (event) => {
//   console.log('Service Worker: Push notification received');
  
//   let notificationData = {
//     title: 'Indian Railways Question Bank',
//     body: 'New question papers available!',
//     icon: '/icons/icon-192x192.png',
//     badge: '/icons/icon-96x96.png',
//     tag: 'question-update',
//     requireInteraction: false,
//     actions: [
//       {
//         action: 'view',
//         title: 'View Now'
//       },
//       {
//         action: 'dismiss',
//         title: 'Dismiss'
//       }
//     ]
//   };

//   if (event.data) {
//     try {
//       const data = event.data.json();
//       notificationData = { ...notificationData, ...data };
//     } catch (e) {
//       notificationData.body = event.data.text();
//     }
//   }

//   event.waitUntil(
//     self.registration.showNotification(notificationData.title, notificationData)
//   );
// });

// // Notification click
// self.addEventListener('notificationclick', (event) => {
//   console.log('Service Worker: Notification clicked', event.action);
  
//   event.notification.close();

//   if (event.action === 'view') {
//     event.waitUntil(clients.openWindow('/pdfs.html'));
//   } else if (event.action === 'dismiss') {
//     return;
//   } else {
//     event.waitUntil(
//       clients.matchAll({ type: 'window', includeUncontrolled: true })
//         .then((clientList) => {
//           for (let i = 0; i < clientList.length; i++) {
//             const client = clientList[i];
//             if (client.url.includes(self.location.origin) && 'focus' in client) {
//               return client.focus();
//             }
//           }
//           if (clients.openWindow) {
//             return clients.openWindow('/');
//           }
//         })
//     );
//   }
// });

// // Message handling
// self.addEventListener('message', (event) => {
//   console.log('Service Worker: Message received', event.data);
  
//   if (event.data && event.data.type === 'SKIP_WAITING') {
//     console.log('Skipping waiting phase');
//     self.skipWaiting();
//   }
  
//   if (event.data && event.data.type === 'CLEAR_CACHE') {
//     event.waitUntil(
//       caches.keys()
//         .then((cacheNames) => {
//           return Promise.all(
//             cacheNames.map((cacheName) => {
//               console.log('Clearing cache:', cacheName);
//               return caches.delete(cacheName);
//             })
//           );
//         })
//         .then(() => {
//           console.log('All caches cleared by request');
//           return self.clients.matchAll();
//         })
//         .then((clients) => {
//           clients.forEach(client => {
//             client.postMessage({ type: 'CACHES_CLEARED' });
//           });
//         })
//     );
//   }
  
//   if (event.data && event.data.type === 'CHECK_UPDATE') {
//     event.waitUntil(
//       self.registration.update()
//         .then(() => {
//           console.log('Update check completed');
//         })
//     );
//   }
// });

// // Periodic sync
// self.addEventListener('periodicsync', (event) => {
//   console.log('Service Worker: Periodic sync triggered', event.tag);
  
//   if (event.tag === 'check-updates') {
//     event.waitUntil(checkForUpdates());
//   }
// });

// async function checkForUpdates() {
//   try {
//     console.log('Checking for updates...');
//     await self.registration.update();
//     return Promise.resolve();
//   } catch (error) {
//     console.error('Update check failed:', error);
//     return Promise.reject(error);
//   }
// }

// // Cache size management
// async function manageCacheSize(cacheName, maxItems) {
//   try {
//     const cache = await caches.open(cacheName);
//     const keys = await cache.keys();
    
//     if (keys.length > maxItems) {
//       console.log(`Cache ${cacheName} has ${keys.length} items, removing oldest...`);
//       await cache.delete(keys[0]);
//       await manageCacheSize(cacheName, maxItems);
//     }
//   } catch (error) {
//     console.error('Cache management error:', error);
//   }
// }

// // Run cache cleanup every 5 minutes
// setInterval(() => {
//   manageCacheSize(RUNTIME_CACHE, 50);
// }, 300000);

// console.log('Service Worker script loaded successfully');
