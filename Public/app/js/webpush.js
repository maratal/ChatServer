// Push Notifications

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Workers not supported');
        return null;
    }
    
    if (!('PushManager' in window)) {
        console.log('Push notifications not supported');
        return null;
    }
    
    try {
        console.log('Registering service worker at: /service-worker.js');
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
        });
        console.log('Service Worker registered successfully:', registration);
        await navigator.serviceWorker.ready;
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return 'denied';
    }
    
    if (Notification.permission === 'granted') {
        return 'granted';
    }
    
    if (Notification.permission === 'denied') {
        return 'denied';
    }
    
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeToPushNotifications() {
    try {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
            console.log('Notification permission not granted');
            return null;
        }
        
        const registration = await registerServiceWorker();
        if (!registration) {
            console.log('Service Worker registration failed');
            return null;
        }
        
        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Create new subscription
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            console.log('Created new push subscription:', subscription);
        } else {
            console.log('Using existing push subscription:', subscription);
        }
        
        return JSON.stringify(subscription);
    } catch (error) {
        console.error('Error subscribing to push notifications:', error);
        return null;
    }
}

async function unsubscribeFromPushNotifications() {
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            return true;
        }
        
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log('Unsubscribed from push notifications');
        }
        return true;
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        return false;
    }
}

// Get device info with push subscription
async function getDeviceInfoWithPush() {
    const deviceInfo = getDeviceInfo();

    try {
        // Try to get push subscription with timeout
        const pushSubscription = await Promise.race([
            subscribeToPushNotifications(),
            new Promise((resolve) => setTimeout(() => resolve(null), 5000)) // 5 second timeout
        ]);
        
        if (pushSubscription) {
            deviceInfo.token = pushSubscription;
            console.log('Push subscription obtained for device');
        } else {
            console.log('Push subscription not available or timed out');
        }
    } catch (error) {
        console.error('Error getting push subscription:', error);
    }

    return deviceInfo;
}

// Listen for messages from service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'OPEN_CHAT' && event.data?.chatId) {
            // If this chat doesn't exist locally, reload chats
            if (!chats.some(chat => chat.id === event.data.chatId)) {
                // Message for a new chat, fetch chats again
                loadChats();
            }
        }
    });
}