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
    const item = document.createElement('button');
    item.className = 'chat-item';
    item.dataset.chatId = chat.id; // Add chat ID as data attribute
    item.onclick = () => selectChat(chat.id);
    
    // Determine chat name and avatar
    let chatName, avatarContent, hasOnlineStatus = false;
    
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
            hasOnlineStatus = true; // Show online status for personal chats
        }
    } else {
        // For group chats, show chat title
        chatName = chat.title || 'Group Chat';
        avatarContent = getInitials(chatName);
    }
    
    // Get last message preview and time
    const lastMessageText = chat.lastMessage ? 
        truncateText(chat.lastMessage.text || '[Media]', 30) : 
        'No messages yet';
    
    const messageTime = chat.lastMessage ? 
        formatMessageTime(new Date(chat.lastMessage.createdAt)) : '';
    
    // Check if there are unread messages (placeholder for now)
    const unreadCount = 0; // This would come from the API
    
    item.innerHTML = `
        <div class="chat-avatar">
            <span class="chat-avatar-container">
                <span class="chat-avatar-initials">${escapeHtml(avatarContent)}</span>
                ${hasOnlineStatus ? '<span class="chat-status-indicator"></span>' : ''}
            </span>
        </div>
        <div class="chat-info">
            <div class="chat-header-row">
                <h3 class="chat-name">${escapeHtml(chatName)}</h3>
                ${messageTime ? `<span class="chat-time">${messageTime}</span>` : ''}
            </div>
            <div class="chat-message-row">
                <p class="chat-last-message">${escapeHtml(lastMessageText)}</p>
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    return item;
}

// Format message time for chat list
function formatMessageTime(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        // Yesterday
        return 'Yesterday';
    } else if (days < 7) {
        // This week - show day name
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        // Older - show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
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
    const chatHeaderStatusIndicator = document.getElementById('chatHeaderStatusIndicator');
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
            chatHeaderStatusIndicator.style.display = 'none'; // No status for self-chat
        } else {
            chatTitle.textContent = otherUser.name;
            chatSubtitle.textContent = `Online`;
            chatHeaderAvatar.textContent = getInitials(otherUser.name);
            console.log('Setting status indicator to visible for user:', otherUser.name);
            chatHeaderStatusIndicator.style.display = 'block'; // Show status for other users
        }
    } else {
        messagesContainer.classList.remove('personal-chat');
        chatTitle.textContent = chat.title || 'Group Chat';
        chatSubtitle.textContent = `${chat.allUsers.length} members`;
        chatHeaderAvatar.textContent = getInitials(chat.title || 'Group Chat');
        chatHeaderStatusIndicator.style.display = 'none'; // No status for group chats
    }
    
    chatHeader.style.display = 'flex';
    
    // Add click handler to chat header avatar
    const chatHeaderAvatarContainer = document.getElementById('chatHeaderAvatarContainer');
    if (chatHeaderAvatarContainer) {
        if (chat.isPersonal) {
            const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
            if (otherUser) {
                chatHeaderAvatarContainer.onclick = () => showUserInfo(otherUser.id);
                chatHeaderAvatarContainer.style.cursor = 'pointer';
            } else {
                chatHeaderAvatarContainer.onclick = null;
                chatHeaderAvatarContainer.style.cursor = 'default';
            }
        } else if (chat.isPersonalNotesChat) {
            // For personal notes, don't make avatar clickable
            chatHeaderAvatarContainer.onclick = null;
            chatHeaderAvatarContainer.style.cursor = 'default';
        } else {
            // For group chats, do nothing (yet)
            chatHeaderAvatarContainer.onclick = null;
            chatHeaderAvatarContainer.style.cursor = 'pointer';
        }
    }
    
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

// Utility function to scroll messages to bottom
function scrollMessagesToBottom(instant = false) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    // Find the scrollable parent container
    const scrollableContainer = messagesContainer.parentElement;
    if (!scrollableContainer) return;

    // Scroll to the very bottom, accounting for padding
    const targetScrollTop = scrollableContainer.scrollHeight - scrollableContainer.clientHeight;
    
    if (instant) {
        scrollableContainer.scrollTop = targetScrollTop;
    } else {
        scrollableContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'auto'
        });
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
    
    // Group messages by author, time, and date
    const messagesWithGrouping = [];
    let currentDate = null;
    
    messages.forEach((message, index) => {
        const messageDate = new Date(message.createdAt);
        const messageDateString = messageDate.toDateString();
        
        // Add date header if date changed
        if (currentDate !== messageDateString) {
            if (currentDate !== null) {
                // Add date header (except for the first message)
                messagesWithGrouping.push({
                    type: 'date-header',
                    date: messageDate,
                    dateString: formatDateHeader(messageDate)
                });
            }
            currentDate = messageDateString;
        }
        
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
        
        // Check if messages should be grouped
        const sameAuthorAsPrev = prevMessage && prevMessage.authorId === message.authorId;
        const sameAuthorAsNext = nextMessage && nextMessage.authorId === message.authorId;
        
        // Check time difference (10 minutes = 600000 milliseconds)
        const timeDiffWithPrev = prevMessage ? 
            Math.abs(new Date(message.createdAt) - new Date(prevMessage.createdAt)) : Infinity;
        const timeDiffWithNext = nextMessage ? 
            Math.abs(new Date(nextMessage.createdAt) - new Date(message.createdAt)) : Infinity;
        
        const closeTimeToPrev = timeDiffWithPrev <= 600000; // 10 minutes
        const closeTimeToNext = timeDiffWithNext <= 600000; // 10 minutes
        
        // Check if dates are the same
        const sameDateAsPrev = prevMessage && 
            new Date(prevMessage.createdAt).toDateString() === messageDate.toDateString();
        const sameDateAsNext = nextMessage && 
            new Date(nextMessage.createdAt).toDateString() === messageDate.toDateString();
        
        const shouldGroupWithPrev = sameAuthorAsPrev && closeTimeToPrev && sameDateAsPrev;
        const shouldGroupWithNext = sameAuthorAsNext && closeTimeToNext && sameDateAsNext;
        
        let groupPosition;
        if (!shouldGroupWithPrev && !shouldGroupWithNext) {
            groupPosition = 'single';
        } else if (!shouldGroupWithPrev && shouldGroupWithNext) {
            groupPosition = 'first';
        } else if (shouldGroupWithPrev && shouldGroupWithNext) {
            groupPosition = 'middle';
        } else if (shouldGroupWithPrev && !shouldGroupWithNext) {
            groupPosition = 'last';
        }
        
        messagesWithGrouping.push({ 
            ...message, 
            groupPosition, 
            type: 'message'
        });
    });
    
    // Render messages and date headers
    messagesWithGrouping.forEach(item => {
        if (item.type === 'date-header') {
            const dateHeader = createDateHeader(item.dateString);
            messagesContainer.appendChild(dateHeader);
        } else {
            const messageElement = createMessageElement(item);
            messagesContainer.appendChild(messageElement);
        }
    });
    
    // Scroll to bottom instantly when loading messages
    setTimeout(() => {
        scrollMessagesToBottom(true); // instant scroll for loading messages
    }, 50);
}

// Create date header element
function createDateHeader(dateString) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'date-header';
    headerDiv.innerHTML = `<span class="date-header-text">${dateString}</span>`;
    return headerDiv;
}

// Format date for header display
function formatDateHeader(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today - messageDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'long' });
    } else {
        return date.toLocaleDateString([], { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

// Create a message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-bubble';
    
    // Set the author ID, timestamp, and IDs as data attributes
    messageDiv.dataset.authorId = message.authorId || '';
    messageDiv.dataset.createdAt = message.createdAt || new Date().toISOString();
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
    
    // Find author info
    const author = chat?.allUsers.find(user => user.id === message.authorId);
    const authorName = author ? author.name : 'Unknown';
    const authorInitials = author ? getInitials(author.name) : '?';
    
    // Add grouping class if it exists
    if (message.groupPosition) {
        messageDiv.classList.add(`group-${message.groupPosition}`);
        console.log(`Applied class: group-${message.groupPosition} to message from ${authorName}`);
    } else {
        console.log(`No groupPosition for message from ${authorName}`);
    }
    
    // Format time
    const messageTime = new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Check if this is a group chat (show author names only for group chats)
    const isGroupChat = chat && !chat.isPersonal;
    
    // Create status icon for own messages
    const statusIcon = isOwnMessage ? `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="message-status-icon">
            <path d="M18 6 7 17l-5-5"></path>
            <path d="m22 10-7.5 7.5L13 16"></path>
        </svg>
    ` : '';
    
    // Build avatar HTML
    const avatarAuthorId = message.authorId;
    const avatarDataAttrs = avatarAuthorId != null
        ? `data-author-id="${avatarAuthorId}" data-clickable="true"` 
        : '';
    
    messageDiv.innerHTML = `
        <span class="message-avatar-small" ${avatarDataAttrs}>
            <span class="message-avatar-initials">${authorInitials}</span>
        </span>
        <div class="message-content-wrapper">
            ${(isGroupChat && !isOwnMessage) ? `<span class="message-author-name">${escapeHtml(authorName)}</span>` : ''}
            <div class="message-content">
                <p class="message-text">${convertLinksToClickable(message.text || '[Media]')}</p>
                <div class="message-timestamp-area">
                    <span class="message-time">${messageTime}</span>
                    ${statusIcon}
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
    
    console.log('Updating display with:', userName);
    
    // Update sidebar current user avatar
    const sidebarAvatar = document.getElementById('sidebarCurrentUserAvatarContent');
    if (sidebarAvatar) {
        const initials = getInitials(userName);
        sidebarAvatar.textContent = initials;
    }
}

// Profile menu functionality
function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('profileMenu');
    const button = document.getElementById('profileMenuButton');
    
    if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
        menu.style.display = 'none';
    }
});

// Update send button state
function updateSendButtonState() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    if (messageInput && sendButton) {
        const hasText = messageInput.value.trim().length > 0;
        if (hasText) {
            sendButton.classList.remove('hidden');
            sendButton.classList.add('visible');
        } else {
            sendButton.classList.remove('visible');
            sendButton.classList.add('hidden');
        }
    }
}

// Message input handling
function initializeMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    function adjustHeight() {
        // Reset to auto to get natural height
        messageInput.style.height = 'auto';
        // Set to scroll height, constrained by CSS max-height
        messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
        
        // Update send button state
        updateSendButtonState();
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
    updateSendButtonState();
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
    
    // Clear input and update send button state
    messageInput.value = '';
    messageInput.style.height = '38px'; // Reset to initial height
    updateSendButtonState();
    
    // Restore focus to input after sending
    messageInput.focus();
    
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
    
    // For now, just add the message with 'single' grouping
    // The regrouping will happen after
    const messageWithGrouping = {
        ...message,
        groupPosition: 'single',
        type: 'message'
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
    
    // Re-calculate grouping for the new message and potentially the previous one
    console.log('About to recalculate grouping for newly added message');
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
        updateMessageGroupingIncremental(messageElement);
        console.log('Finished incremental grouping update');
    }, 10);
    
    // Scroll to bottom
    setTimeout(() => {
        scrollMessagesToBottom();
    }, animated ? 300 : 0);
}

// Update message grouping incrementally for newly added message
function updateMessageGroupingIncremental(newMessageElement) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElements = Array.from(messagesContainer.children).filter(el => el.classList.contains('message-bubble'));
    
    // Find the index of the new message
    const newMessageIndex = messageElements.indexOf(newMessageElement);
    if (newMessageIndex === -1) {
        console.warn('New message element not found in container');
        return;
    }
    
    console.log(`Updating grouping for message at index ${newMessageIndex}`);
    
    // Get the messages we need to potentially update (previous, current, next)
    const messagesToUpdate = [];
    
    // Add previous message if it exists (its grouping might change from 'last' to 'middle')
    if (newMessageIndex > 0) {
        messagesToUpdate.push({
            element: messageElements[newMessageIndex - 1],
            index: newMessageIndex - 1
        });
    }
    
    // Add the new message
    messagesToUpdate.push({
        element: newMessageElement,
        index: newMessageIndex
    });
    
    // Add next message if it exists (shouldn't normally happen for new messages, but just in case)
    if (newMessageIndex < messageElements.length - 1) {
        messagesToUpdate.push({
            element: messageElements[newMessageIndex + 1],
            index: newMessageIndex + 1
        });
    }
    
    // Update grouping for each affected message
    messagesToUpdate.forEach(({ element, index }) => {
        updateSingleMessageGrouping(element, index, messageElements);
    });
}

// Update grouping for a single message based on its neighbors
function updateSingleMessageGrouping(messageElement, index, allMessageElements) {
    const prevElement = index > 0 ? allMessageElements[index - 1] : null;
    const nextElement = index < allMessageElements.length - 1 ? allMessageElements[index + 1] : null;
    
    const currentAuthorId = messageElement.dataset.authorId;
    const currentCreatedAt = messageElement.dataset.createdAt;
    
    // Check if messages should be grouped
    const sameAuthorAsPrev = prevElement && prevElement.dataset.authorId === currentAuthorId;
    const sameAuthorAsNext = nextElement && nextElement.dataset.authorId === currentAuthorId;
    
    // Check time difference (10 minute rule)
    let timeGapWithPrev = false;
    let timeGapWithNext = false;
    
    if (prevElement && prevElement.dataset.createdAt && currentCreatedAt) {
        const prevTime = new Date(prevElement.dataset.createdAt);
        const currentTime = new Date(currentCreatedAt);
        const timeDiff = Math.abs(currentTime - prevTime) / (1000 * 60); // minutes
        timeGapWithPrev = timeDiff > 10;
    }
    
    if (nextElement && nextElement.dataset.createdAt && currentCreatedAt) {
        const nextTime = new Date(nextElement.dataset.createdAt);
        const currentTime = new Date(currentCreatedAt);
        const timeDiff = Math.abs(nextTime - currentTime) / (1000 * 60); // minutes
        timeGapWithNext = timeDiff > 10;
    }
    
    // Messages should be grouped if same author AND within 10 minutes
    const shouldGroupWithPrev = sameAuthorAsPrev && !timeGapWithPrev;
    const shouldGroupWithNext = sameAuthorAsNext && !timeGapWithNext;
    
    let groupPosition;
    if (!shouldGroupWithPrev && !shouldGroupWithNext) {
        groupPosition = 'single';
    } else if (!shouldGroupWithPrev && shouldGroupWithNext) {
        groupPosition = 'first';
    } else if (shouldGroupWithPrev && shouldGroupWithNext) {
        groupPosition = 'middle';
    } else if (shouldGroupWithPrev && !shouldGroupWithNext) {
        groupPosition = 'last';
    }
    
    // Remove existing group classes
    messageElement.classList.remove('group-single', 'group-first', 'group-middle', 'group-last');
    
    // Add new group class
    messageElement.classList.add(`group-${groupPosition}`);
    
    console.log(`Message ${index}: author=${currentAuthorId}, groupPosition=${groupPosition}`);
}

// Recalculate message grouping for all messages in container (used for initial load)
function recalculateMessageGrouping() {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElements = Array.from(messagesContainer.children).filter(el => el.classList.contains('message-bubble'));
    
    console.log('Recalculating grouping for', messageElements.length, 'messages');
    
    // Use the single message grouping function for each message
    messageElements.forEach((messageElement, index) => {
        updateSingleMessageGrouping(messageElement, index, messageElements);
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

// User Info Modal Functions
async function showUserInfo(userId) {
    if (!userId) return;
    
    const modal = document.getElementById('userInfoModal');
    const body = document.getElementById('userInfoBody');
    
    // Show modal - same pattern as user selection modal
    modal.style.display = 'block';
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    body.innerHTML = '<div class="user-info-loading">Loading user information...</div>';
    
    const accessToken = getAccessToken(); // optional in this request

    try {
        const response = await fetch(`/users/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch user info:', response.status, errorText);
            throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
        }
        
        const user = await response.json();
        console.log('User data received:', user);
        displayUserInfo(user);
    } catch (error) {
        console.error('Error fetching user info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load user information'}</div>`;
    }
}

function displayUserInfo(user) {
    const body = document.getElementById('userInfoBody');
    
    const initials = getInitials(user.name || user.username || '?');
    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    const lastAccess = user.lastAccess ? formatLastAccess(user.lastAccess) : null;
    const isOnline = user.lastAccess ? isUserOnline(user.lastAccess) : false;
    
    // Get user photo if available
    const photoUrl = user.photos && user.photos.length > 0 
        ? `/files/${user.photos[0].id}` 
        : null;
    
    let html = `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar">
                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(name)}">` : initials}
            </div>
        </div>
        <div class="user-info-name">${escapeHtml(name)}</div>
        <div class="user-info-username">@${escapeHtml(username)}</div>
    `;
    
    // Status section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Status</div>
            <div class="user-info-status">
                <span class="user-info-status-indicator ${isOnline ? '' : 'offline'}"></span>
                <span>${isOnline ? 'Online' : lastAccess ? `Last seen ${lastAccess}` : 'Offline'}</span>
            </div>
        </div>
    `;
    
    // About section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">About</div>
            <div class="user-info-about ${about ? '' : 'empty'}">
                ${about ? escapeHtml(about) : 'No bio available'}
            </div>
        </div>
    `;
    
    // Meta information
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>User ID: ${user.id || 'N/A'}</span>
                </div>
                ${lastAccess ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Last access: ${lastAccess}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
}

function closeUserInfo() {
    const modal = document.getElementById('userInfoModal');
    modal.classList.remove('show');
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function formatLastAccess(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function isUserOnline(lastAccess) {
    const date = new Date(lastAccess);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    // Consider online if last access was within 5 minutes
    return diffMins < 5;
}

// Handle avatar clicks using event delegation
document.addEventListener('click', function(event) {
    // Check if clicked element is a message avatar or inside it
    let avatar = event.target.closest('.message-avatar-small[data-clickable="true"]');
    
    // Also check if the clicked element itself is the avatar
    if (!avatar && event.target.classList.contains('message-avatar-small') && event.target.dataset.clickable === 'true') {
        avatar = event.target;
    }
    
    // Also check if clicked inside avatar initials
    if (!avatar && event.target.closest('.message-avatar-initials')) {
        avatar = event.target.closest('.message-avatar-small[data-clickable="true"]');
    }
    
    if (avatar && avatar.dataset.authorId) {
        event.preventDefault();
        event.stopPropagation();
        const userId = parseInt(avatar.dataset.authorId);
        if (userId && !isNaN(userId)) {
            console.log('Opening user info for user ID:', userId);
            showUserInfo(userId);
            return;
        }
    }
    
    // Close user info modal when clicking outside
    const modal = document.getElementById('userInfoModal');
    const content = document.querySelector('.user-info-content');
    if (modal && modal.classList.contains('show') && content && !content.contains(event.target)) {
        closeUserInfo();
    }
}, true); // Use capture phase to catch events earlier

// Close user info modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeUserInfo();
    }
});

