// Global variables
let currentUser = null;
let currentChatId = null;
let chats = [];
let websocket = null;
let deviceSessionId = null;
let pendingMessages = new Map(); // Track messages being sent

// User selection variables
let currentUsers = [];
let userSearchTimeout = null;
let lastUserId = null;
let isLoadingUsers = false;
let hasMoreUsers = true;

// Logout function
async function logout() {
    const accessToken = getAccessToken();
    
    if (accessToken) {
        try {
            // Call logout API
            await fetch('/users/me/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
        }
    }
    
    // Clear local storage
    localStorage.removeItem('currentUser');
    
    // Redirect to home page
    window.location.href = '/';
}

// Enhanced authentication check to get current user
async function checkAuth() {
    console.log('checkAuth called');
    const currentUserData = localStorage.getItem('currentUser');
    
    console.log('Current user data:', currentUserData ? 'exists' : 'missing');
    
    if (!currentUserData) {
        console.log('No current user data, redirecting to home');
        window.location.href = '/';
        return;
    }
    
    try {
        const userData = JSON.parse(currentUserData);
        currentUser = userData;
        console.log('Parsed currentUser from localStorage:', currentUser);
        
        if (!getAccessToken()) {
            console.log('No access token in current user data, redirecting to home');
            window.location.href = '/';
            return;
        }
        
        try {
            updateCurrentUserDisplay();
        } catch (error) {
            console.error('Error updating current user display:', error);
        }
        
        // Get device session ID for WebSocket
        deviceSessionId = getDeviceSessionId();
        
        // Initialize everything
        await initializeChat();
        initializeMessageInput();
        
        // Initialize WebSocket if device session ID is available
        if (deviceSessionId) {
            initializeWebSocket();
        } else {
            console.error('Device sessionId is empty.');
        }
    } catch (e) {
        console.error('Error parsing current user data:', e);
        // If parsing fails, redirect to login
        window.location.href = '/';
    }
}

// Check authentication when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth().catch(console.error);
    });
} else {
    checkAuth().catch(console.error);
}

// Initialize the chat interface
async function initializeChat() {
    await loadChats();
}

// Load chats from API
async function loadChats() {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/chats/?full=1', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            chats = await response.json();
            displayChats();
        } else {
            console.error('Failed to load chats:', response.statusText);
        }
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Display chats in the sidebar
function displayChats() {
    const chatItems = document.getElementById('chatItems');
    chatItems.innerHTML = '';
    
    if (chats.length === 0) {
        chatItems.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chats yet</div>';
        return;
    }
    
    chats.forEach(chat => {
        const chatItem = createChatItem(chat);
        chatItems.appendChild(chatItem);
    });
}

// Create a chat item element
function createChatItem(chat) {
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.dataset.chatId = chat.id; // Add chat ID as data attribute
    item.onclick = () => selectChat(chat.id);
    
    // Determine chat name and avatar
    let chatName, avatarContent;
    
    if (chat.isPersonal) {
        // For personal chats, show the other user's name
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself
            chatName = 'Personal Notes';
            avatarContent = '✏️';
        } else {
            chatName = otherUser.name;
            avatarContent = getInitials(otherUser.name);
        }
    } else {
        // For group chats, show chat title
        chatName = chat.title || 'Group Chat';
        avatarContent = '👥'; // Group icon
    }
    
    // Get last message preview
    const lastMessageText = chat.lastMessage ? 
        truncateText(chat.lastMessage.text || '[Media]', 30) : 
        'No messages yet';
    
    item.innerHTML = `
        <div class="chat-avatar">${avatarContent}</div>
        <div class="chat-info">
            <div class="chat-name">${escapeHtml(chatName)}</div>
            <div class="chat-last-message">${escapeHtml(lastMessageText)}</div>
        </div>
    `;
    
    return item;
}

// Select a chat and load its messages
async function selectChat(chatId) {
    currentChatId = chatId;
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Add/remove personal chat class for styling
    if (chat.isPersonal) {
        messagesContainer.classList.add('personal-chat');
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself
            chatTitle.textContent = 'Personal Notes';
            chatSubtitle.textContent = 'Notes to yourself';
            chatHeaderAvatar.textContent = '✏️';
        } else {
            chatTitle.textContent = otherUser.name;
            chatSubtitle.textContent = `Personal chat`;
            chatHeaderAvatar.textContent = getInitials(otherUser.name);
        }
        chatHeaderAvatar.style.display = 'flex';
    } else {
        messagesContainer.classList.remove('personal-chat');
        chatTitle.textContent = chat.title || 'Group Chat';
        chatSubtitle.textContent = `${chat.allUsers.length} members`;
        chatHeaderAvatar.textContent = '👥';
        chatHeaderAvatar.style.display = 'flex';
    }
    
    chatHeader.style.display = 'flex';
    
    // Show message input
    const messageInputContainer = document.getElementById('messageInputContainer');
    messageInputContainer.style.display = 'flex';
    
    // Load messages
    await loadMessages(chatId);
}

// Load messages for a chat
async function loadMessages(chatId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch(`/chats/${chatId}/messages?count=20`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
        } else {
            console.error('Failed to load messages:', response.statusText);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Display messages in the chat area
function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages" style="text-align: center; color: #666; padding: 40px;">No messages in this chat</div>';
        return;
    }
    
    // Reverse messages to show oldest first
    messages.reverse();
    
    // Group messages by author and determine position in group
    const messagesWithGrouping = messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
        
        const sameAsPrev = prevMessage && prevMessage.authorId === message.authorId;
        const sameAsNext = nextMessage && nextMessage.authorId === message.authorId;
        const isAuthorChange = !sameAsPrev;
        
        let groupPosition;
        if (!sameAsPrev && !sameAsNext) {
            groupPosition = 'single';
        } else if (!sameAsPrev && sameAsNext) {
            groupPosition = 'first';
        } else if (sameAsPrev && sameAsNext) {
            groupPosition = 'middle';
        } else if (sameAsPrev && !sameAsNext) {
            groupPosition = 'last';
        }
        
        return { ...message, groupPosition, isAuthorChange };
    });
    
    messagesWithGrouping.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create a message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Set the author ID and local ID as data attributes
    messageDiv.dataset.authorId = message.authorId || '';
    if (message.localId) {
        messageDiv.dataset.localId = message.localId;
    }
    if (message.id) {
        messageDiv.dataset.messageId = message.id;
    }
    
    const chat = chats.find(c => c.id === currentChatId);
    
    // Check if this is a personal notes chat (chat with oneself)
    const otherUser = chat?.isPersonal ? chat.allUsers.find(user => user.id !== currentUser?.info.id) : null;
    const isPersonalNotesChat = chat?.isPersonal && (!otherUser || otherUser.id === currentUser?.info.id);
    
    const isOwnMessage = currentUser && message.authorId && message.authorId === currentUser.info.id && !isPersonalNotesChat;
    if (isOwnMessage) {
        messageDiv.classList.add('own');
    }
    
    // Add grouping class for corner radius styling
    if (message.groupPosition) {
        messageDiv.classList.add(`group-${message.groupPosition}`);
    }
    
    // Add author-change class for additional spacing
    if (message.isAuthorChange) {
        messageDiv.classList.add('author-change');
    }
    
    // Find author info
    const author = chat?.allUsers.find(user => user.id === message.authorId);
    const authorName = author ? author.name : 'Unknown';
    const authorInitials = author ? getInitials(author.name) : '?';
    
    // Format time
    const messageTime = new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Check if this is a group chat (show author names only for group chats)
    const isGroupChat = chat && !chat.isPersonal;
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${authorInitials}</div>
        <div class="message-wrapper">
            ${(isGroupChat && !isOwnMessage) ? `<div class="message-author">${escapeHtml(authorName)}</div>` : ''}
            <div class="message-content-row">
                <div class="message-content">
                    <div class="message-text">${convertLinksToClickable(message.text || '[Media]')}</div>
                    <div class="message-time">${messageTime}</div>
                </div>
            </div>
        </div>
    `;
    
    return messageDiv;
}

// Utility functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function convertLinksToClickable(text) {
    if (!text) return '';
    
    // First escape HTML to prevent XSS
    const escapedText = escapeHtml(text);
    
    // URL regex pattern that matches http, https, and www links
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    
    return escapedText.replace(urlRegex, function(url) {
        let href = url;
        let displayUrl = url;
        
        // Add https:// prefix for www links
        if (url.toLowerCase().startsWith('www.')) {
            href = 'https://' + url;
        }
        
        // Truncate display URL if it's too long
        if (displayUrl.length > 50) {
            displayUrl = displayUrl.substring(0, 47) + '...';
        }
        
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${displayUrl}</a>`;
    });
}

// Update current user display in chat list header
function updateCurrentUserDisplay() {
    console.log('updateCurrentUserDisplay called', currentUser);
    
    if (!currentUser || !currentUser.info) {
        console.log('No currentUser or currentUser.info');
        return;
    }
    
    const userName = currentUser.info.name || currentUser.info.username || 'User';
    const userInitials = getInitials(userName);
    
    console.log('Updating display with:', userName, userInitials);
    
    const nameElement = document.getElementById('currentUserName');
    const avatarElement = document.getElementById('currentUserAvatar');
    
    console.log('Elements found:', nameElement, avatarElement);
    
    if (nameElement) nameElement.textContent = userName;
    if (avatarElement) avatarElement.textContent = userInitials;
}

// Toggle menu dropdown
function toggleMenu() {
    const dropdown = document.getElementById('menuDropdown');
    dropdown.classList.toggle('show');
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menuButton = event.target.closest('.menu-button');
    const dropdown = document.getElementById('menuDropdown');
    
    if (!menuButton && dropdown) {
        dropdown.classList.remove('show');
    }
});

// Message input handling
function initializeMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    function adjustHeight() {
        // Reset to auto to get natural height
        messageInput.style.height = 'auto';
        // Set to scroll height, constrained by CSS max-height
        messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
        
        // Show/hide send button
        const hasText = messageInput.value.trim().length > 0;
        sendButton.classList.toggle('visible', hasText);
    }
    
    messageInput.addEventListener('input', adjustHeight);
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim()) {
                sendMessage();
            }
        }
    });
    
    // Initial adjustment
    adjustHeight();
}

// Generate local ID for messages
function generateLocalId() {
    return `${currentUser.info.id}+${crypto.randomUUID()}`;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text || !currentChatId || !currentUser || !currentUser.info.id) return;
    
    const localId = generateLocalId();
    
    // Create message object
    const message = {
        localId: localId,
        chatId: currentChatId,
        authorId: currentUser.info.id,
        text: text,
        createdAt: new Date().toISOString(),
        isVisible: true,
        attachments: [],
        readMarks: [],
        isPending: true
    };
    
    // Clear input and hide send button
    messageInput.value = '';
    messageInput.style.height = '38px'; // Reset to initial height
    document.getElementById('sendButton').classList.remove('visible');
    
    // Add message to pending list
    pendingMessages.set(localId, message);
    
    // Display message immediately with sending state
    addMessageToChat(message, true);
    
    // Update chat list with new message
    updateChatListWithMessage(message);
    
    // Send to server using the shared function
    await sendMessageToServer(message);
}

// Add message to chat with animation
function addMessageToChat(message, animated = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Remove "no chat selected" message if present
    const noChat = messagesContainer.querySelector('.no-chat-selected');
    if (noChat) {
        noChat.remove();
    }
    
    // Remove "No messages in this chat" message if present
    const noMessages = messagesContainer.querySelector('.no-messages');
    if (noMessages) {
        noMessages.remove();
    }
    
    // Determine grouping for the new message
    const existingMessages = Array.from(messagesContainer.children);
    const lastMessage = existingMessages[existingMessages.length - 1];
    let isAuthorChange = true;
    let initialGroupPosition = 'single';
    
    if (lastMessage && lastMessage.dataset.authorId) {
        isAuthorChange = lastMessage.dataset.authorId !== message.authorId.toString();
        if (!isAuthorChange) {
            // Same author as previous message - this will be 'last' and previous should be updated
            initialGroupPosition = 'last';
        }
    }
    
    // Create message element
    const messageWithGrouping = {
        ...message,
        groupPosition: initialGroupPosition,
        isAuthorChange: isAuthorChange
    };
    
    const messageElement = createMessageElement(messageWithGrouping);
    
    if (message.isPending) {
        messageElement.classList.add('sending');
        addSendingIndicator(messageElement);
    }
    
    if (animated) {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        messagesContainer.appendChild(messageElement);
        
        // Trigger animation
        requestAnimationFrame(() => {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
    } else {
        messagesContainer.appendChild(messageElement);
    }
    
    // Scroll to bottom
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, animated ? 300 : 0);
    
    // Update grouping for all messages to ensure consistency
    updateMessageGrouping();
}

// Update message grouping
function updateMessageGrouping() {
    const messagesContainer = document.getElementById('messagesContainer');
    const messages = Array.from(messagesContainer.children);
    
    console.log('Updating message grouping for', messages.length, 'messages');
    
    messages.forEach((messageEl, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
        
        const currentAuthor = messageEl.dataset.authorId;
        const prevAuthor = prevMessage?.dataset.authorId;
        const nextAuthor = nextMessage?.dataset.authorId;
        
        const sameAsPrev = prevAuthor === currentAuthor;
        const sameAsNext = nextAuthor === currentAuthor;
        
        // Remove existing group classes
        messageEl.classList.remove('group-single', 'group-first', 'group-middle', 'group-last');
        
        let groupPosition;
        if (!sameAsPrev && !sameAsNext) {
            groupPosition = 'single';
        } else if (!sameAsPrev && sameAsNext) {
            groupPosition = 'first';
        } else if (sameAsPrev && sameAsNext) {
            groupPosition = 'middle';
        } else if (sameAsPrev && !sameAsNext) {
            groupPosition = 'last';
        }
        
        messageEl.classList.add(`group-${groupPosition}`);
        
        console.log(`Message ${index}: author=${currentAuthor}, prev=${prevAuthor}, next=${nextAuthor}, position=${groupPosition}, classes=${messageEl.className}`);
    });
}

// Update existing message
function updateMessageInChat(localId, serverMessage) {
    const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
    if (messageElement) {
        messageElement.classList.remove('sending');
        messageElement.dataset.messageId = serverMessage.id;
        
        // Remove sending indicator
        const sendingIndicator = messageElement.querySelector('.message-sending');
        if (sendingIndicator) {
            sendingIndicator.remove();
        }
    }
}

// Add sending indicator
function addSendingIndicator(messageElement) {
    const sendingIndicator = document.createElement('span');
    sendingIndicator.className = 'message-sending';
    sendingIndicator.textContent = 'Sending...';
    
    const messageContentRow = messageElement.querySelector('.message-content-row');
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContentRow && messageContent) {
        // For own messages, insert before the message content to appear on the left
        messageContentRow.insertBefore(sendingIndicator, messageContent);
    }
}

// Mark message as failed
function markMessageAsFailed(localId) {
    const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
    if (messageElement) {
        messageElement.classList.remove('sending');
        messageElement.classList.add('error');
        
        // Remove sending indicator
        const sendingIndicator = messageElement.querySelector('.message-sending');
        if (sendingIndicator) {
            sendingIndicator.remove();
        }
        
        // Add error indicator in front of the message balloon
        const errorIndicator = document.createElement('span');
        errorIndicator.className = 'message-error';
        errorIndicator.innerHTML = '⚠️';
        errorIndicator.title = 'Failed to send. Click to retry.';
        errorIndicator.onclick = () => retryMessage(localId);
        
        const messageContentRow = messageElement.querySelector('.message-content-row');
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContentRow && messageContent) {
            // For own messages, insert before the message content to appear on the left
            messageContentRow.insertBefore(errorIndicator, messageContent);
        }
    }
}

// Retry failed message
function retryMessage(localId) {
    const message = pendingMessages.get(localId);
    if (message) {
        // Remove error indicator
        const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
        const errorIndicator = messageElement?.querySelector('.message-error');
        if (errorIndicator) {
            errorIndicator.remove();
        }
        
        messageElement?.classList.remove('error');
        messageElement?.classList.add('sending');
        
        // Add sending indicator back
        if (messageElement) {
            addSendingIndicator(messageElement);
        }
        
        // Retry sending
        sendMessageToServer(message);
    }
}

// Send message to server (helper function)
async function sendMessageToServer(message) {
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            console.error('No access token available');
            markMessageAsFailed(message.localId);
            return;
        }
        
        const response = await fetch(`/chats/${message.chatId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                localId: message.localId,
                text: message.text,
                isVisible: true
            })
        });
        
        if (response.ok) {
            const serverMessage = await response.json();
            pendingMessages.delete(message.localId);
            updateMessageInChat(message.localId, serverMessage);
        } else {
            markMessageAsFailed(message.localId);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        markMessageAsFailed(message.localId);
    }
}

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
    
    const protocol = 'ws:'; // window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/${deviceSessionId}?token=${encodeURIComponent(accessToken)}`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function() {
            console.log('WebSocket connected');
        };
        
        websocket.onmessage = function(event) {
            console.log('WebSocket received:', event.data);
            
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
    if (notification.event === 'message' && notification.payload) {
        const message = notification.payload;
        
        // Check if this is for the current chat
        if (message.chatId === currentChatId) {
            // Check if we already have this message (by localId)
            const existingElement = document.querySelector(`[data-local-id="${message.localId}"]`);
            
            if (existingElement) {
                // Update existing message
                updateMessageInChat(message.localId, message);
            } else {
                // Add new message from others
                addMessageToChat(message, true);
            }
        }
        
        // Update chat list with new message
        updateChatListWithMessage(message);
    }
}

// Update chat list when new message arrives
function updateChatListWithMessage(message) {
    const chat = chats.find(c => c.id === message.chatId);
    if (chat) {
        chat.lastMessage = message;
        
        // Find the specific chat item in the DOM and update only the last message text
        const chatItem = document.querySelector(`[data-chat-id="${message.chatId}"]`);
        if (chatItem) {
            const lastMessageElement = chatItem.querySelector('.chat-last-message');
            if (lastMessageElement) {
                const lastMessageText = message.text ? 
                    truncateText(message.text, 30) : 
                    '[Media]';
                lastMessageElement.textContent = lastMessageText;
            }
        }
    }
}

// Get access token from current user session
function getAccessToken() {
    return currentUser.session.accessToken;
}

// Get device session ID from current user session
function getDeviceSessionId() {
    return currentUser.session.id;
}

// User Selection Functions
function openUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.style.display = 'block';
    
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    // Reset state
    currentUsers = [];
    lastUserId = null;
    hasMoreUsers = true;
    isLoadingUsers = false;
    
    // Clear search input
    document.getElementById('userSearchInput').value = '';
    
    // Load initial users
    loadUsers();
    
    // Setup search listener
    setupUserSearch();
    
    // Setup scroll listener for pagination
    setupUserScrollPagination();
}

function closeUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.classList.remove('show');
    
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Clear timeout if exists
    if (userSearchTimeout) {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = null;
    }
}

function setupUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    
    searchInput.addEventListener('input', function() {
        // Clear existing timeout
        if (userSearchTimeout) {
            clearTimeout(userSearchTimeout);
        }
        
        // Set new timeout for search
        userSearchTimeout = setTimeout(() => {
            const query = this.value.trim();
            if (query) {
                searchUsers(query);
            } else {
                // Reset to all users if search is cleared
                currentUsers = [];
                lastUserId = null;
                hasMoreUsers = true;
                loadUsers();
            }
        }, 300);
    });
}

function setupUserScrollPagination() {
    const usersList = document.getElementById('usersList');
    
    usersList.addEventListener('scroll', function() {
        // Check if scrolled to bottom
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            // Load more users if available and not currently loading
            if (hasMoreUsers && !isLoadingUsers && !document.getElementById('userSearchInput').value.trim()) {
                loadUsers();
            }
        }
    });
}

async function loadUsers() {
    if (isLoadingUsers || !hasMoreUsers) return;
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        showUsersError('Authentication required');
        return;
    }
    
    isLoadingUsers = true;
    
    try {
        const response = await fetch(`/users/all?id=${lastUserId || 1}&limit=20`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            // Add users to current users
            if (users.length > 0) {
                currentUsers = [...currentUsers, ...users];
                // Update lastUserId to the ID of the last user for cursor-based pagination
                lastUserId = users[users.length - 1].id;
            }
            
            // Set hasMoreUsers to false if we got less than the requested amount (20)
            if (users.length < 20) {
                hasMoreUsers = false;
            }
            
            displayUsers();
        } else {
            console.error('Failed to load users:', response.statusText);
            showUsersError('Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showUsersError('Error loading users');
    } finally {
        isLoadingUsers = false;
    }
}

async function searchUsers(query) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        showUsersError('Authentication required');
        return;
    }
    
    const usersList = document.getElementById('usersList');
    
    // Show loading
    usersList.innerHTML = '<div class="users-loading">Searching users...</div>';
    
    try {
        const response = await fetch(`/users?s=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            currentUsers = users;
            displayUsers();
        } else {
            console.error('Failed to search users:', response.statusText);
            showUsersError('Failed to search users');
        }
    } catch (error) {
        console.error('Error searching users:', error);
        showUsersError('Error searching users');
    }
}

function displayUsers() {
    const usersList = document.getElementById('usersList');
    
    if (currentUsers.length === 0) {
        usersList.innerHTML = '<div class="users-empty">No users found</div>';
        return;
    }
    
    let html = '';
    currentUsers.forEach(user => {
        const userInitials = getInitials(user.name || user.username || '?');
        html += `
            <div class="user-item" onclick="selectUser(${user.id})">
                <div class="user-item-avatar">${userInitials}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(user.name || user.username || 'Unknown User')}</div>
                    <div class="user-item-username">@${escapeHtml(user.username || 'unknown')}</div>
                </div>
            </div>
        `;
    });
    
    // Add loading indicator if there are more users to load
    if (hasMoreUsers && !document.getElementById('userSearchInput').value.trim()) {
        html += '<div class="users-loading" style="padding: 20px;">Loading more users...</div>';
    }
    
    usersList.innerHTML = html;
}

function showUsersError(message) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = `<div class="users-empty">${message}</div>`;
}

async function selectUser(userId) {
    // Close modal
    closeUserSelection();
    
    // Create or find chat with this user
    await createOrOpenPersonalChat(userId);
}

async function createOrOpenPersonalChat(userId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        alert('Authentication required. Please refresh the page.');
        return;
    }
    
    try {
        // First, check if we already have a personal chat with this user
        const existingChat = chats.find(chat => 
            chat.isPersonal && 
            chat.allUsers.some(user => user.id === userId)
        );
        
        if (existingChat) {
            // Open existing chat
            selectChat(existingChat.id);
            return;
        }
        
        // Create new personal chat
        const response = await fetch('/chats', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                isPersonal: true,
                participants: [userId]
            })
        });
        
        if (response.ok) {
            const newChat = await response.json();
            
            // Add to chats list
            chats.unshift(newChat);
            
            // Refresh chat display
            displayChats();
            
            // Select the new chat
            selectChat(newChat.id);
        } else {
            console.error('Failed to create chat:', response.statusText);
            alert('Failed to create chat. Please try again.');
        }
    } catch (error) {
        console.error('Error creating chat:', error);
        alert('Error creating chat. Please try again.');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('userSelectionModal');
    if (event.target === modal) {
        closeUserSelection();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeUserSelection();
    }
});

// Add plus button click handler when page loads
document.addEventListener('DOMContentLoaded', function() {
    const addChatButton = document.getElementById('addChatButton');
    if (addChatButton) {
        addChatButton.addEventListener('click', openUserSelection);
    }
});
