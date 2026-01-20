const CACHE_NAME = 'railbook-v1-' + Date.now();
const GITHUB_REPO = 'dominaltech/railway'; // Replace with your GitHub repo
const GITHUB_BRANCH = 'main'; // or 'master' depending on your default branch

// Files to cache for offline access
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/pdfs.html',
    '/about.html',
    '/manifest.json',
    '/railway.png',
    '/railway1.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.error('Failed to cache:', err);
            });
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('railbook-v1-')) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - Network First strategy with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        fetchWithCacheFallback(request)
    );
});

// Network First with Cache Fallback strategy
async function fetchWithCacheFallback(request) {
    const url = new URL(request.url);

    // For HTML files, always try to fetch fresh content from network first
    if (url.pathname.endsWith('.html') || url.pathname === '/') {
        try {
            const networkResponse = await fetch(request, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (networkResponse && networkResponse.status === 200) {
                // Clone the response before caching
                const responseToCache = networkResponse.clone();

                // Update cache with fresh content
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return networkResponse;
            }
        } catch (error) {
            console.log('Network request failed, falling back to cache:', error);
        }

        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If both network and cache fail, return offline page
        return new Response('<h1>Offline</h1><p>Please check your internet connection.</p>', {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // For other assets (images, CSS, JS), try cache first, then network
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Return cached version and update in background
        fetchAndUpdateCache(request);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
            });
        }
        return networkResponse;
    } catch (error) {
        console.log('Failed to fetch:', request.url, error);
        return new Response('Network error', { status: 408 });
    }
}

// Background fetch and cache update
async function fetchAndUpdateCache(request) {
    try {
        const networkResponse = await fetch(request, {
            cache: 'no-cache'
        });
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
    } catch (error) {
        // Silently fail background updates
    }
}

// Message event for manual cache refresh
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data && event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                return self.clients.claim();
            })
        );
    }

    if (event.data && event.data.action === 'fetchFresh') {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
        );
    }
});

// Push notification event
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New content available!',
        icon: '/railway.png',
        badge: '/railway.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Now',
                icon: '/railway.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/railway.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('RailBook Update', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Periodic background sync for fetching updates (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(
            fetchLatestContent()
        );
    }
});

// Function to fetch latest content from GitHub
async function fetchLatestContent() {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/index.html`, {
            cache: 'no-cache'
        });

        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', response.clone());
            cache.put('/', response);

            // Notify all clients about the update
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'CONTENT_UPDATED',
                    message: 'New content available'
                });
            });
        }
    } catch (error) {
        console.log('Failed to fetch latest content:', error);
    }
}

// Sync event for background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-content') {
        event.waitUntil(fetchLatestContent());
    }
});

console.log('Service Worker loaded successfully');
