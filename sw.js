// Auto-versioning based on current date/time - updates automatically
const CACHE_VERSION = new Date().toISOString().split('T')[0]; // Changes daily
const CACHE_NAME = `indian-railways-qb-${CACHE_VERSION}`;
const RUNTIME_CACHE = `indian-railways-runtime-${CACHE_VERSION}`;

// Files to cache on installation
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/pdfs.html',
  '/my-exams.html',
  '/about.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing with version', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS).catch(err => {
          console.error('Failed to cache some files:', err);
          // Continue even if some files fail
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('Service Worker: Installation complete, skipping waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up ALL old caches aggressively
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating with version', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('Found caches:', cacheNames);
        
        // Delete ALL caches except current ones
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: All old caches cleared');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that SW is activated
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_ACTIVATED',
              version: CACHE_VERSION
            });
          });
        });
      })
  );
});

// Fetch event - NETWORK FIRST for HTML, cache for assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Handle navigation requests - NETWORK FIRST (always fresh)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // Don't cache if not successful
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          console.log('Fetched fresh navigation:', event.request.url);

          // Cache the new version
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        })
        .catch((error) => {
          console.error('Network failed, falling back to cache:', error);
          // Fallback to cache if offline
          return caches.match(event.request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Handle other requests - NETWORK FIRST with cache fallback
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        // Don't cache if not successful
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone and cache the response
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});

// Background sync for notifications
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'sync-questions') {
    event.waitUntil(syncQuestionPapers());
  }
});

// Function to sync question papers
async function syncQuestionPapers() {
  try {
    console.log('Syncing question papers...');
    return Promise.resolve();
  } catch (error) {
    console.error('Sync failed:', error);
    return Promise.reject(error);
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'Indian Railways Question Bank',
    body: 'New question papers available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'question-update',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Now',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/pdfs.html')
    );
  } else if (event.action === 'dismiss') {
    return;
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Message event - communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skipping waiting as requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => {
          return cache.addAll(event.data.urls);
        })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          console.log('All caches cleared by request');
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHES_CLEARED' });
          });
        })
    );
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.waitUntil(
      self.registration.update()
        .then(() => {
          console.log('Manual update check completed');
        })
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync triggered', event.tag);
  
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

// Function to check for updates
async function checkForUpdates() {
  try {
    console.log('Checking for updates...');
    await self.registration.update();
    return Promise.resolve();
  } catch (error) {
    console.error('Update check failed:', error);
    return Promise.reject(error);
  }
}

// Cache size management
async function manageCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
      console.log(`Cache ${cacheName} exceeded ${maxItems} items, cleaning up...`);
      await cache.delete(keys[0]);
      await manageCacheSize(cacheName, maxItems);
    }
  } catch (error) {
    console.error('Cache management error:', error);
  }
}

// Limit runtime cache size - check every minute
setInterval(() => {
  manageCacheSize(RUNTIME_CACHE, 100);
}, 60000);
