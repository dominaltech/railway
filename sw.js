const CACHE_NAME = 'railbook-dynamic-' + Date.now();
const GITHUB_REPO = 'dominaltech/railway'; // Replace with your GitHub repo
const GITHUB_BRANCH = 'main'; // or 'master' depending on your default branch

// Files to cache for offline access
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/pdfs.html',
    '/bookmarks.html',
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
                    if (cacheName !== CACHE_NAME && 
                        (cacheName.startsWith('railbook-v1-') || cacheName.startsWith('railbook-dynamic-'))) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated and taking control');
            return self.clients.claim();
        })
    );
});

// Fetch event - Network First strategy for HTML, Cache First for assets
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
        fetchWithStrategy(request)
    );
});

// Smart fetch strategy - Network First for HTML, Cache First for assets
// Smart fetch strategy - Network First for HTML, Cache First for assets
async function fetchWithStrategy(request) {
    const url = new URL(request.url);
    const isHTMLPage = url.pathname.endsWith('.html') || 
                       url.pathname === '/' || 
                       url.pathname.endsWith('/pdfs') ||
                       url.pathname.endsWith('/bookmarks') ||
                       url.pathname.endsWith('/about');
    
    // Skip Supabase API calls - never cache them
    if (url.hostname.includes('supabase.co')) {
        return fetch(request, { cache: 'no-store' });
    }

    // NETWORK ONLY for HTML pages (bypass cache completely)
    if (isHTMLPage) {
        try {
            console.log('Fetching fresh HTML (bypassing cache):', url.pathname);
            const networkResponse = await fetch(request, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (networkResponse && networkResponse.ok) {
                // DON'T cache HTML - return directly
                return networkResponse;
            }
        } catch (error) {
            console.log('Network failed for HTML:', error);
        }

        // Only use cache if completely offline
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('OFFLINE: Serving cached HTML:', url.pathname);
            return cachedResponse;
        }

        // Last resort: offline message
        return new Response(
            `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - RailBook</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px;
                        background: linear-gradient(135deg, #003366, #0055aa);
                        color: white;
                    }
                    h1 { font-size: 48px; margin: 20px 0; }
                    p { font-size: 18px; }
                    button {
                        background: white;
                        color: #003366;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 8px;
                        cursor: pointer;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <h1>🚂 RailBook</h1>
                <h2>You're Offline</h2>
                <p>Please check your internet connection and try again.</p>
                <button onclick="window.location.reload()">Retry</button>
            </body>
            </html>`,
            { 
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 503,
                statusText: 'Service Unavailable'
            }
        );
    }

    // CACHE FIRST for other assets (CSS, JS, images, fonts)
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // If not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
            });
        }
        return networkResponse;
    } catch (error) {
        console.log('Failed to fetch asset:', request.url, error);
        return new Response('Network error', { 
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}
// Background fetch and cache update for assets
async function fetchAndUpdateCache(request) {
    try {
        const networkResponse = await fetch(request, {
            cache: 'no-cache'
        });
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            console.log('Background updated cache for:', request.url);
        }
    } catch (error) {
        // Silently fail background updates
        console.log('Background update failed:', error);
    }
}

// Message event for manual cache refresh and control
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        console.log('Skip waiting triggered');
        self.skipWaiting();
    }

    if (event.data && event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        console.log('Clearing cache:', cacheName);
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
                console.log('Fetching fresh content');
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
        const pagesToUpdate = [
            'index.html',
            'pdfs.html',
            'bookmarks.html',
            'about.html'
        ];

        const cache = await caches.open(CACHE_NAME);
        
        for (const page of pagesToUpdate) {
            try {
                const response = await fetch(
                    `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${page}`,
                    { cache: 'no-cache' }
                );

                if (response && response.ok) {
                    await cache.put(`/${page}`, response.clone());
                    if (page === 'index.html') {
                        await cache.put('/', response);
                    }
                    console.log('Updated cache for:', page);
                }
            } catch (error) {
                console.log('Failed to update:', page, error);
            }
        }

        // Notify all clients about the update
        const allClients = await self.clients.matchAll();
        allClients.forEach(client => {
            client.postMessage({
                type: 'CONTENT_UPDATED',
                message: 'New content available'
            });
        });
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

console.log('Service Worker loaded successfully with Network First strategy for HTML');
