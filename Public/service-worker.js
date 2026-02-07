// Service Worker for Push Notifications
'use strict';

// Handle push notification events
self.addEventListener('push', event => {
    console.log('[Service Worker] Push notification received:', event);
    console.log('[Service Worker] Event data exists:', !!event.data);
    
    // Handle empty push notifications (no data)
    if (!event.data) {
        console.log('[Service Worker] Push event but no data - showing generic notification');
        const options = {
            body: 'You have a new message',
            icon: '/app/images/icon.png',
            badge: '/app/images/badge.png',
            tag: 'chat-notification',
            data: {
                url: '/main'
            },
            requireInteraction: false,
            silent: false
        };
        
        event.waitUntil(
            self.registration.showNotification('New Message', options)
                .then(() => console.log('[Service Worker] Notification displayed successfully'))
                .catch(err => console.error('[Service Worker] Failed to show notification:', err))
        );
        return;
    }
    
    try {
        console.log('[Service Worker] Attempting to parse data as JSON');
        const data = event.data.json();
        console.log('[Service Worker] Parsed push data:', data);
        
        // Parse the notification payload
        const payload = data.payload || {};
        let title = 'New Message';
        let body = 'You have a new message';
        let icon = '/app/images/icon.png';
        let badge = '/app/images/badge.png';
        let tag = 'chat-notification';
        let chatId = null;
        
        // Customize based on event type
        if (data.event === 'message' && payload.text) {
            body = payload.text;
            if (payload.chatId) {
                chatId = payload.chatId;
                tag = `chat-${chatId}`;
            }
            if (payload.sender) {
                title = `Message from ${payload.sender}`;
            }
        } else if (data.event === 'auxiliary') {
            title = payload.title || 'Notification';
            body = payload.body || 'You have a new notification';
        }
        
        const options = {
            body: body,
            icon: icon,
            badge: badge,
            tag: tag,
            data: {
                chatId: chatId,
                event: data.event,
                source: data.source,
                url: chatId ? `/main?chat=${chatId}` : '/main'
            },
            requireInteraction: false,
            silent: false
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (error) {
        console.error('Error processing push event:', error);
    }
});

// Handle notification click events
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked:', event.notification);
    
    event.notification.close();
    
    // Use absolute URL for Safari compatibility
    const relativePath = event.notification.data?.url || '/main';
    const urlToOpen = new URL(relativePath, self.location.origin).href;
    
    console.log('[Service Worker] Opening URL:', urlToOpen);
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            console.log('[Service Worker] Found window clients:', windowClients.length);
            
            // Check if there's already a window open
            for (let client of windowClients) {
                if (client.url.includes('/main') && 'focus' in client) {
                    console.log('[Service Worker] Focusing existing window');
                    // Navigate to the chat if needed
                    if (event.notification.data?.chatId) {
                        client.postMessage({
                            type: 'OPEN_CHAT',
                            chatId: event.notification.data.chatId
                        });
                    }
                    return client.focus();
                }
            }
            // If no window is open, open a new one
            console.log('[Service Worker] Opening new window to:', urlToOpen);
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen)
                    .then(client => {
                        console.log('[Service Worker] Window opened successfully:', client);
                        return client;
                    })
                    .catch(err => {
                        console.error('[Service Worker] Failed to open window:', err);
                        // Fallback: try opening with a different approach
                        return null;
                    });
            } else {
                console.error('[Service Worker] clients.openWindow not available');
            }
        }).catch(err => {
            console.error('[Service Worker] Error handling notification click:', err);
        })
    );
});

// Handle service worker activation
self.addEventListener('activate', event => {
    console.log('Service Worker activated');
    event.waitUntil(clients.claim());
});

// Handle service worker installation
self.addEventListener('install', event => {
    console.log('Service Worker installed');
    self.skipWaiting();
});
