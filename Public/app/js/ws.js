// WebSocket functionality

function initializeWebSocket() {
    if (!deviceSessionId) {
        console.warn('No device session ID available for WebSocket');
        return;
    }
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.warn('No access token available for WebSocket');
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/${deviceSessionId}?token=${encodeURIComponent(accessToken)}`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function() {
            console.log('WebSocket connected');
        };
        
        websocket.onmessage = function(event) {
            console.log('WebSocket event received:', event.data);
            
            // Handle both text and binary (Blob) messages
            if (event.data instanceof Blob) {
                // Convert Blob to text
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        console.log('Blob content as text:', reader.result);
                        const notification = JSON.parse(reader.result);
                        handleWebSocketMessage(notification);
                    } catch (error) {
                        console.error('Error parsing Blob message as JSON:', error);
                        console.error('Blob text content:', reader.result);
                        console.error('First 100 characters:', reader.result.substring(0, 100));
                    }
                };
                reader.readAsText(event.data);
            } else {
                // Handle text messages normally
                try {
                    const notification = JSON.parse(event.data);
                    handleWebSocketMessage(notification);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    console.error('Raw message data:', event.data);
                    console.error('Message type:', typeof event.data);
                    console.error('First 100 characters:', event.data.substring(0, 100));
                }
            }
        };
        
        websocket.onclose = function(event) {
            console.log('WebSocket disconnected');
            console.log('Close code:', event.code);
            console.log('Close reason:', event.reason);
            console.log('Was clean:', event.wasClean);
            
            // Attempt to reconnect after a delay
            setTimeout(() => {
                if (deviceSessionId) {
                    initializeWebSocket();
                }
            }, 5000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            console.error('WebSocket URL:', wsUrl);
            console.error('Ready state:', websocket.readyState);
        };
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(notification) {
    if ((notification.event === 'message' || notification.event === 'messageUpdate') && notification.payload) {
        const message = notification.payload;
        
        // Play sound for new messages from others
        if (notification.event === 'message' && !isOwnMessage(message)) {
            playNotificationSound();
        }
        
        // Check if this is for the current chat
        if (message.chatId === currentChatId) {
            // Check if we already have this message (by localId)
            const existingElement = document.querySelector(`[data-local-id="${message.localId}"]`);
            
            if (existingElement) {
                // Update existing message
                replaceMessageElement(message.localId, message, !isOwnMessage(message) && !message.deletedAt);
            } else {
                // Add new message from others
                addMessageToChat(message);
                // Update chat display
                displayChats();
            }
        } else if (!chats.some(chat => chat.id === message.chatId)) {
            // Message for a new chat, fetch chats again
            loadChats();
        } else {
            // Message for a different existing chat, update chat list
            displayChats();
        }
        
        // Update chat list with new message
        updateChatListWithMessage(message);
    }
    else if (notification.event === 'chatDeleted' && notification.payload) {
        const chatId = notification.payload.id;
        // Remove deleted chat from list
        const chatIndex = chats.findIndex(chat => chat.id === chatId);
        if (chatIndex !== -1) {
            chats.splice(chatIndex, 1);
            displayChats();
            if (currentChatId === chatId) {
                currentChatId = null;
                makeNoChatsSelected();
            }
        }
    }
    else if (notification.event === 'messageRead' && notification.payload) {
        const message = notification.payload;
        
        // Update lastReferenceReadMessageId if this is an outgoing message with readMarks from other users
        if (isOwnMessage(message) && message.readMarks) {
            // Only update if this ID is greater than current lastReferenceReadMessageId
            if (!lastReferenceReadMessageId || message.id > lastReferenceReadMessageId) {
                lastReferenceReadMessageId = message.id;
            }
        }
        
        // Update the chat's lastMessage with new readMarks
        const chat = chats.find(c => c.id === message.chatId);
        if (chat) {
            // If this is the last message, update it with new readMarks
            if (chat.lastMessage && chat.lastMessage.id === message.id) {
                chat.lastMessage = message;
            }
            
            // Update read status display if this is the current chat
            if (message.chatId === currentChatId) {
                showCurrentChatMessagesAsRead();
            }
        }
    }
}
