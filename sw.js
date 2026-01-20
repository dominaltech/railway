// Auto-versioning based on timestamp
const CACHE_VERSION = new Date().getTime();
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
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clear ALL old caches for fresh updates
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Delete ALL old caches to force fresh content
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
        console.log('Service Worker: Activated with fresh cache');
        return self.clients.claim();
      })
  );
});

// Fetch event - NETWORK FIRST strategy for HTML, cache for assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle navigation requests - NETWORK FIRST
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache if not successful
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Cache the new version
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Handle other requests (images, scripts, styles) - CACHE FIRST
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version but update in background
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(RUNTIME_CACHE)
                  .then((cache) => {
                    cache.put(event.request, response);
                  });
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not successful
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
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
    // Implement your sync logic here
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
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if app is already open
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if not open
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
          console.log('All caches cleared');
        })
    );
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.waitUntil(
      self.registration.update()
        .then(() => {
          console.log('Update check completed');
        })
    );
  }
});

// Periodic background sync for scheduled notifications
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
    // Force update check
    await self.registration.update();
    return Promise.resolve();
  } catch (error) {
    console.error('Update check failed:', error);
    return Promise.reject(error);
  }
}

// Cache size management
async function manageCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    manageCacheSize(cacheName, maxItems);
  }
}

// Limit runtime cache size - check every 5 minutes
setInterval(() => {
  manageCacheSize(RUNTIME_CACHE, 100);
}, 300000);

// Force update check on service worker activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll()
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Service Worker updated and activated'
          });
        });
      })
  );
});
