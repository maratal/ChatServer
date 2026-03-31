// Utility functions

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const b64 = atob(parts[1]);
    const u8arr = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) u8arr[i] = b64.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
}

// Generate a thumbnail data URL from a video source (File or URL string)
// Returns a promise that resolves with a data URL
function generateVideoThumbnail(source) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        const isBlobUrl = source instanceof File;
        let settled = false;

        function finish(dataUrl) {
            if (settled) return;
            settled = true;
            if (isBlobUrl) URL.revokeObjectURL(video.src);
            video.removeAttribute('src');
            video.load();
            resolve(dataUrl);
        }

        function fail(err) {
            if (settled) return;
            settled = true;
            if (isBlobUrl) URL.revokeObjectURL(video.src);
            video.removeAttribute('src');
            video.load();
            reject(err);
        }

        function captureFrame() {
            try {
                const w = video.videoWidth || 320;
                const h = video.videoHeight || 240;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(video, 0, 0, w, h);
                finish(canvas.toDataURL('image/jpeg', 0.7));
            } catch (e) {
                fail(e);
            }
        }

        video.addEventListener('seeked', captureFrame);

        video.addEventListener('loadeddata', () => {
            const t = video.duration && isFinite(video.duration) ? Math.min(0.5, video.duration) : 0;
            if (t > 0) {
                video.currentTime = t;
            } else {
                // Can't seek — capture whatever frame we have
                captureFrame();
            }
        });

        video.addEventListener('error', () => fail(new Error('Failed to load video')));

        // Timeout after 8 seconds
        setTimeout(() => fail(new Error('Video thumbnail timeout')), 8000);

        video.src = isBlobUrl ? URL.createObjectURL(source) : source;
    });
}

// Fun "no messages" variants
const NO_MESSAGES_VARIANTS = [
    "No messages yet... Break the ice! 🧊",
    "Ready to start chatting? 💬",
    "This chat is a blank canvas 🎨",
    "Nothing here but potential ✨",
    "Looks like a fresh start! 🌱",
    "Your words could be the first! ✍️",
    "Time to start a conversation! 💬",
    "Empty inbox = infinite possibilities 🚀",
    "Say hello and get things rolling! 👋",
    "A new adventure begins here 🎯"
];

function getRandomNoMessagesText() {
    return NO_MESSAGES_VARIANTS[Math.floor(Math.random() * NO_MESSAGES_VARIANTS.length)];
}

// Avatar color generation - 20 distinct vivid colors
const AVATAR_COLORS = (function() {
    const colors = [];
    for (let i = 0; i < 20; i++) {
        const hue = (i * 18) % 360; // 360/20 = 18 degrees apart
        colors.push({
            text: `hsl(${hue}, 70%, 45%)`,           // Vivid text color
            background: `hsl(${hue}, 60%, 92%)`      // Light background (almost white)
        });
    }
    return colors;
})();

// Get or assign avatar color for a user
function getAvatarColorForUser(userId) {
    if (!userId) return AVATAR_COLORS[0];
    
    const storageKey = 'avatarColorAssignments';
    
    // Load existing assignments
    let assignments = {};
    try {
        assignments = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
        assignments = {};
    }
    
    // If user already has a color, return it
    if (assignments[userId] !== undefined) {
        return AVATAR_COLORS[assignments[userId]];
    }
    
    // Extract used indices from assignments
    const usedIndices = Object.values(assignments);
    
    // Find next available color index
    let availableIndices = [];
    for (let i = 0; i < 20; i++) {
        if (!usedIndices.includes(i)) {
            availableIndices.push(i);
        }
    }
    
    // If all colors used, reset the cycle
    if (availableIndices.length === 0) {
        availableIndices = Array.from({ length: 20 }, (_, i) => i);
    }
    
    // Pick a random color from available ones
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    
    // Save assignment
    assignments[userId] = randomIndex;
    localStorage.setItem(storageKey, JSON.stringify(assignments));
    
    return AVATAR_COLORS[randomIndex];
}

// Generate avatar initials HTML with color styling
function getAvatarInitialsHtml(name, userId, extraClasses = '') {
    const initials = getInitials(name);
    const color = getAvatarColorForUser(userId);
    const classes = extraClasses ? `avatar-initials ${extraClasses}` : 'avatar-initials';
    return `<span class="${classes}" style="color: ${color.text}; background-color: ${color.background};">${initials}</span>`;
}

// Get image HTML
function getAvatarImageHtml(imageInfo) {
    return `<img src="${getPreviewUrl(imageInfo.id, imageInfo.fileType)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
}

// Get avatar HTML (image or initials)
function getAvatarHtml(user) {
    const mainPhoto = mainPhotoForUser(user);
    const avatarHtml = mainPhoto 
            ? getAvatarImageHtml(mainPhoto)
            : getAvatarInitialsHtml(user.name || user.username || '?', user.id);
    return avatarHtml;
}

// Apply avatar color to an existing element
function applyAvatarColor(element, name, userId) {
    const color = getAvatarColorForUser(userId);
    element.textContent = getInitials(name);
    element.style.color = color.text;
    element.style.backgroundColor = color.background;
}

// Generate local ID for messages
function generateMessageLocalId() {
    return `${currentUser.info.id}+${crypto.randomUUID()}`;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

function mainPhotoForUser(user) {
    if (!user || !user.photos || !Array.isArray(user.photos) || user.photos.length === 0) return null;
    const firstPhoto = user.photos[0];
    if (!firstPhoto || !firstPhoto.id || !firstPhoto.fileType) return null;
    return firstPhoto;
}

function mainImageForChat(chat) {
    if (!chat || !chat.images || !Array.isArray(chat.images) || chat.images.length === 0) return null;
    const firstImage = chat.images[0];
    if (!firstImage || !firstImage.id || !firstImage.fileType) return null;
    return firstImage;
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

// Format message time for chat list
function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today - messageDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    else if (diffDays === 1) {
        return 'Yesterday';
    }
    else if (diffDays < 7) {
        // This week - show day name
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    else {
        // Older - show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Format date for grouping messages by date
function formatChatGroupingDate(date) {
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

// Normalize timestamp to Date object (handles both string and number formats)
function normalizeTimestamp(timestamp) {
    if (!timestamp) return new Date();
    
    if (typeof timestamp === 'string') {
        return new Date(timestamp);
    } else if (typeof timestamp === 'number') {
        // Server sends UNIX timestamps in seconds (since 1970)
        // If timestamp is less than year 2000 in milliseconds, assume it's in seconds
        if (timestamp < 946_684_800_000) { // 2000-01-01 00:00:00
            return new Date(timestamp * 1000);
        } else {
            return new Date(timestamp);
        }
    }
    
    return new Date(timestamp);
}

// Format full date and time for tooltips
function formatFullDateTime(date) {
    const dateObj = normalizeTimestamp(date);
    return dateObj.toLocaleString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function isMediaUrl(url) {
    const path = url.split('?')[0].split('#')[0];
    const ext = path.split('.').pop().toLowerCase();
    return /^(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/.test(ext);
}

// Convert links in text to clickable links
function formatMessageText(text) {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    const escaped = escapeHtml(text);

    // Step 1: Process markdown named links — 📺[label](url) opens inline media popup on hover,
    // any md link to media opens in the media viewer on click, others open in a new tab.
    const mdLinkPlaceholders = [];
    let processed = escaped.replace(/(📺)?\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/gi, function(_, tvIcon, label, url) {
        const href = url.toLowerCase().startsWith('www.') ? 'https://' + url : url;
        let html;
        if (tvIcon) {
            html = `<span class="inline-media-wrapper"><a href="#" class="inline-media-link" data-media-url="${href}" onmouseenter="openInlineMediaPopup(this)" onmouseleave="scheduleCloseInlineMediaPopup()" onclick="openMediaViewerForUrl('${href}'); return false;" style="color: hsl(var(--primary)); text-decoration: underline; cursor: pointer;"><b>${label}</b></a></span>`;
        } else if (isMediaUrl(href)) {
            html = `<a href="#" onclick="openMediaViewerForUrl('${href}'); return false;" style="color: hsl(var(--primary)); text-decoration: underline; cursor: pointer;">${label}</a>`;
        } else {
            html = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline;">${label}</a>`;
        }
        const idx = mdLinkPlaceholders.length;
        mdLinkPlaceholders.push(html);
        return `\x00MDLINK${idx}\x00`;
    });

    // Step 2: Apply bold and italic formatting
    processed = processed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![\w*])_(.+?)_(?![\w*])/g, '<em>$1</em>');

    // Step 3: Auto-link plain URLs, skipping text already inside HTML tags or placeholders
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    processed = processed.split(/(<[^>]*>|\x00MDLINK\d+\x00)/).map((segment, i) => {
        if (i % 2 === 1) return segment; // HTML tag or placeholder — leave alone
        return segment.replace(urlRegex, (url) => {
            let href = url;
            let displayUrl = url;
            if (url.toLowerCase().startsWith('www.')) href = 'https://' + url;
            if (displayUrl.length > 100) displayUrl = displayUrl.substring(0, 100) + '...';
            if (isMediaUrl(href)) {
                return `<a href="#" onclick="openMediaViewerForUrl('${href}'); return false;" style="color: inherit; text-decoration: underline; cursor: pointer;">${displayUrl}</a>`;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${displayUrl}</a>`;
        });
    }).join('');

    // Step 4: Restore markdown link placeholders
    if (mdLinkPlaceholders.length > 0) {
        processed = processed.replace(/\x00MDLINK(\d+)\x00/g, (_, idx) => mdLinkPlaceholders[parseInt(idx, 10)]);
    }

    return processed;
}


function openMediaViewerForUrl(url) {
    closeInlineMediaPopup();
    const ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    const isVideo = /^(mp4|webm|mov)$/.test(ext);
    openMediaViewer([{ _blobUrl: url, fileType: ext }], 0, null, null, isVideo);
}

let inlineMediaPopupCloseTimer = null;

function openInlineMediaPopup(linkElement) {
    // Cancel any pending close so hovering back keeps the popup open
    if (inlineMediaPopupCloseTimer) {
        clearTimeout(inlineMediaPopupCloseTimer);
        inlineMediaPopupCloseTimer = null;
    }

    // If there's already a popup for this exact link, nothing to do
    const existing = document.getElementById('inlineMediaPopup');
    if (existing && existing.dataset.forLink === linkElement.getAttribute('data-media-url')) return;

    closeInlineMediaPopup();

    const url = linkElement.getAttribute('data-media-url');
    const ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    const isVideo = /^(mp4|webm|mov)$/.test(ext);

    const popupElement = document.createElement('div');
    popupElement.id = 'inlineMediaPopup';
    popupElement.className = 'inline-media-popup';
    popupElement.dataset.forLink = url;
    // Keep popup open while the mouse is over it
    popupElement.addEventListener('mouseenter', () => {
        if (inlineMediaPopupCloseTimer) {
            clearTimeout(inlineMediaPopupCloseTimer);
            inlineMediaPopupCloseTimer = null;
        }
    });
    popupElement.addEventListener('mouseleave', scheduleCloseInlineMediaPopup);

    let mediaElement;
    if (isVideo) {
        mediaElement = document.createElement('video');
        mediaElement.src = url;
        mediaElement.controls = true;
        mediaElement.muted = true;
        mediaElement.autoplay = true;
        mediaElement.className = 'inline-media-popup-content video';
    } else {
        mediaElement = document.createElement('img');
        mediaElement.src = url;
        mediaElement.alt = '';
        mediaElement.className = 'inline-media-popup-content';
    }
    popupElement.appendChild(mediaElement);

    // Position using fixed viewport coords (same strategy as context menu)
    document.body.appendChild(popupElement);

    const rect = linkElement.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const gap = 20;

    // Decide vertical side: prefer below, flip above if not enough room below
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top;
    if (spaceBelow >= popupRect.height + gap || spaceBelow >= spaceAbove) {
        top = rect.bottom + gap;
    } else {
        top = rect.top - popupRect.height - gap;
    }

    // Horizontal: align to link left, clamp to viewport
    let left = rect.left;
    if (left + popupRect.width > window.innerWidth - 10) left = window.innerWidth - popupRect.width - 10;
    if (left < 10) left = 10;

    // Final vertical clamp
    if (top + popupRect.height > window.innerHeight - 10) top = window.innerHeight - popupRect.height - 10;
    if (top < 10) top = 10;

    popupElement.style.left = left + 'px';
    popupElement.style.top = top + 'px';

    if (isVideo) {
        mediaElement.play().catch(() => {});
    }
}

function scheduleCloseInlineMediaPopup() {
    inlineMediaPopupCloseTimer = setTimeout(closeInlineMediaPopup, 120);
}

function closeInlineMediaPopup() {
    if (inlineMediaPopupCloseTimer) {
        clearTimeout(inlineMediaPopupCloseTimer);
        inlineMediaPopupCloseTimer = null;
    }
    const popupElement = document.getElementById('inlineMediaPopup');
    if (popupElement) {
        const videoElement = popupElement.querySelector('video');
        if (videoElement) videoElement.pause();
        popupElement.remove();
    }
}

function formatLastSeen(dateString) {
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

// Get image dimensions
function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 300, height: 200 });
        };
        img.src = url;
    });
}

// Get group chat display name - title or comma-joined member names (up to first 10)
function getGroupChatDisplayName(chat) {
    if (chat.isPersonal) {
        return null;
    }
    
    if (chat.title) {
        return chat.title;
    }
    
    if (!chat.allUsers || chat.allUsers.length === 0) {
        return 'Group Chat';
    }
    
    // Filter out current user and get first 10 members
    const otherMembers = chat.allUsers
        .filter(user => user.id !== currentUser?.info?.id)
        .slice(0, 10)
        .map(user => user.name || user.username || 'Unknown');
    
    if (otherMembers.length === 0) {
        return 'Group Chat';
    }
    
    return otherMembers.join(', ') + ", you";
}

function isOwnMessage(message) {
    return currentUser && message.author.id && message.author.id === currentUser.info.id;
}

// Helper function to find message by ID in DOM
function findMessageById(messageId) {
    // Check DOM
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return null;
    
    // Extract message data from DOM
    const messageTextElement = messageElement.querySelector('.message-text, .personal-note-body, .personal-note-title');
    const messageText = messageTextElement ? messageTextElement.textContent.trim() : '';
    const attachmentsStr = messageElement.dataset.attachments;
    const attachments = attachmentsStr ? JSON.parse(attachmentsStr) : [];
    const createdAt = messageElement.dataset.createdAt;
    
    return {
        id: messageId,
        text: messageText,
        attachments: attachments,
        createdAt: createdAt
    };
}

/**
 * Get the message input element
 */
function getMessageInputElement() {
    return document.getElementById('messageInput');
}

function getChatLastMessageText(chat) {
    if (!chat) return '';
    if (!chat.lastMessage) return 'No messages';

    if (chat.lastMessage.deletedAt != null) {
        return '[Message was deleted]';
    }
    if (chat.lastMessage.text) {
        return truncateText(chat.lastMessage.text, 30);
    }
    if (chat.lastMessage.attachments && chat.lastMessage.attachments.length > 0) {
        return '[Media]';
    }
    if (chat.lastMessage.id) {
        return '[Media was removed]';
    }
    return 'No messages';
}

// Play sound when receiving a new message
function playNotificationSound() {
    // Load notification sound (M4A format works in both Safari and Firefox)
    const notificationSound = new Audio('/app/sounds/notification.m4a');
    notificationSound.volume = 0.5;
    
    notificationSound.play().catch(error => {
        console.log('Could not play notification sound:', error);
    });
}

// Helper functions for managing unread count in localStorage
function getStorageUnreadCount(chatId) {
    if (!chatId) return null;
    const key = `unreadCount_${chatId}`;
    const value = localStorage.getItem(key);
    return value ? parseInt(value, 10) : 0;
}

function setStorageUnreadCount(chatId, count) {
    if (!chatId) return;
    const key = `unreadCount_${chatId}`;
    if (count > 0) {
        localStorage.setItem(key, count.toString());
    } else {
        localStorage.removeItem(key);
    }
}

function isMessageReadByCurrentUser(message) {
    if (!message) return false;
    if (isOwnMessage(message)) return true;
    if (!message.readMarks) return false;
    return message.readMarks.some(mark => mark.user.id === currentUser.info.id);
}

function resolveUnreadCount(chat) {
    var unreadCount = getStorageUnreadCount(chat.id);
    if (unreadCount === 0 && chat.lastMessage && !isMessageReadByCurrentUser(chat.lastMessage)) {
        unreadCount = 1;
        setStorageUnreadCount(chat.id, unreadCount);
    }
    return unreadCount;
}

// Async delay helper
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if a string is a debug command prefix
function stringIsDebugPrefix(str) {
    return str.startsWith('/debug') || str.startsWith('/d');
}

// Wrapper for handleDebugCommand to handle debug command in message input
function handleDebugCommandWrapper(text) {
    // Uncomment the following line to handle debug command in message input
    // return handleDebugCommand(text);
    return false;
}

// ── Shared Attachment & Video Functions ──────────────────────────────────────

function buildAttachmentHTML(attachments, messageId, overlayHTML) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return '';
    }

    const validAttachments = attachments.filter(att => att && att.id && att.fileType);
    if (validAttachments.length === 0) return '';

    const firstAttachment = validAttachments[0];
    const hasMultipleAttachments = validAttachments.length > 1;

    const isImage = firstAttachment.fileType.match(/^(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = firstAttachment.fileType.match(/^(mp4|webm|mov)$/i);

    return `
        <div class="message-attachment-container" data-message-id="${messageId}" onclick="openMessageAttachmentViewer('${messageId}')" style="cursor: pointer;">
            ${hasMultipleAttachments ? `
            <button class="message-attachment-chevron message-attachment-chevron-left" onclick="event.stopPropagation(); navigateMessageAttachment('${messageId}', -1)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m14 18-6-6 6-6"></path>
                </svg>
            </button>
            ` : ''}
            ${isImage ? `
            <img class="message-attachment-image" src="${getPreviewUrl(firstAttachment.id, firstAttachment.fileType)}" alt="Attachment">
            ` : isVideo ? `
            <div class="message-attachment-video-wrapper" data-video-src="/uploads/${firstAttachment.id}.${firstAttachment.fileType}" onmouseleave="stopBalloonVideoPreview(this)">
                <img class="message-attachment-image" src="${getVideoPreviewUrl(firstAttachment.id)}" alt="Video">
            </div>
            ` : ''}
            ${hasMultipleAttachments ? `
            <button class="message-attachment-chevron message-attachment-chevron-right" onclick="event.stopPropagation(); navigateMessageAttachment('${messageId}', 1)">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m10 18 6-6-6-6"></path>
                </svg>
            </button>
            ` : ''}
            <div class="media-overlay-bar">
                ${isVideo ? `
                <div class="video-info-left" onmouseenter="startBalloonVideoPreview(this.closest('.message-attachment-container').querySelector('.message-attachment-video-wrapper'))">
                    <div class="video-camera-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>
                    </div>
                    <span class="video-duration" data-video-src="/uploads/${firstAttachment.id}.${firstAttachment.fileType}">${firstAttachment.duration ? formatVideoDuration(firstAttachment.duration) : ''}</span>
                </div>
                ` : ''}
                ${hasMultipleAttachments ? `
                <div class="media-overlay-pagination" onclick="event.stopPropagation();">
                    ${validAttachments.map((att, index) => `
                        <button class="message-attachment-pagination-dot ${index === 0 ? 'active' : ''}" 
                                onclick="event.stopPropagation(); switchMessageAttachment('${messageId}', ${index})"></button>
                    `).join('')}
                </div>
                ` : ''}
                ${overlayHTML || ''}
            </div>
        </div>
    `;
}

function navigateMessageAttachment(messageId, direction) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-row, .personal-note-row');
    if (!messageDiv) return;

    const attachments = JSON.parse(messageDiv.dataset.attachments || '[]');
    if (attachments.length <= 1) return;

    let currentIndex = parseInt(messageDiv.dataset.currentAttachmentIndex || '0');
    currentIndex += direction;

    if (currentIndex < 0) {
        currentIndex = attachments.length - 1;
    } else if (currentIndex >= attachments.length) {
        currentIndex = 0;
    }

    switchMessageAttachment(messageId, currentIndex);
}

function switchMessageAttachment(messageId, index) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-row, .personal-note-row');
    if (!messageDiv) return;

    const attachments = JSON.parse(messageDiv.dataset.attachments || '[]');
    if (index < 0 || index >= attachments.length) return;

    const attachment = attachments[index];
    const container = messageDiv.querySelector('.message-attachment-container');
    if (!container) return;

    const isImage = attachment.fileType.match(/^(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = attachment.fileType.match(/^(mp4|webm|mov)$/i);

    const currentMedia = container.querySelector('.message-attachment-image, .message-attachment-video-wrapper, .message-attachment-video');
    if (currentMedia) {
        if (isImage) {
            const img = document.createElement('img');
            img.className = 'message-attachment-image';
            img.src = getPreviewUrl(attachment.id, attachment.fileType);
            img.alt = 'Attachment';
            currentMedia.replaceWith(img);
            const overlayBarInfo = img.closest('.message-attachment-container')?.querySelector('.media-overlay-bar .video-info-left');
            if (overlayBarInfo) overlayBarInfo.remove();
        } else if (isVideo) {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-attachment-video-wrapper';
            wrapper.dataset.videoSrc = `/uploads/${attachment.id}.${attachment.fileType}`;
            const img = document.createElement('img');
            img.className = 'message-attachment-image';
            img.alt = 'Video';
            img.src = getVideoPreviewUrl(attachment.id);
            wrapper.onmouseleave = function() { stopBalloonVideoPreview(this); };
            wrapper.appendChild(img);
            currentMedia.replaceWith(wrapper);
            const overlayBar = wrapper.closest('.message-attachment-container')?.querySelector('.media-overlay-bar');
            if (overlayBar) {
                const existingVideoInfo = overlayBar.querySelector('.video-info-left');
                if (existingVideoInfo) {
                    const durationSpan = existingVideoInfo.querySelector('.video-duration');
                    if (durationSpan) {
                        durationSpan.dataset.videoSrc = `/uploads/${attachment.id}.${attachment.fileType}`;
                        durationSpan.textContent = attachment.duration ? formatVideoDuration(attachment.duration) : '';
                    }
                } else {
                    const videoInfo = document.createElement('div');
                    videoInfo.className = 'video-info-left';
                    videoInfo.onmouseenter = function() { startBalloonVideoPreview(this.closest('.message-attachment-container').querySelector('.message-attachment-video-wrapper')); };
                    videoInfo.innerHTML = `<div class="video-camera-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg></div><span class="video-duration" data-video-src="/uploads/${attachment.id}.${attachment.fileType}">${attachment.duration ? formatVideoDuration(attachment.duration) : ''}</span>`;
                    overlayBar.insertBefore(videoInfo, overlayBar.firstChild);
                }
            }
        }
    }

    const dots = container.querySelectorAll('.message-attachment-pagination-dot');
    dots.forEach((dot, i) => {
        if (i === index) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    messageDiv.dataset.currentAttachmentIndex = index;
}

function openMessageAttachmentViewer(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-row, .personal-note-row');
    if (!messageDiv) return;

    const attachments = JSON.parse(messageDiv.dataset.attachments || '[]');
    if (attachments.length === 0) return;

    const currentIndex = parseInt(messageDiv.dataset.currentAttachmentIndex || '0');

    const messageTextElement = messageDiv.querySelector('.message-text');
    const messageText = messageTextElement ? messageTextElement.textContent.trim() : null;

    const messageCreatedAt = messageDiv.dataset.createdAt;
    const mediaPhotos = attachments.map(att => ({
        id: att.id,
        fileType: att.fileType,
        createdAt: messageCreatedAt
    }));

    const currentAtt = attachments[currentIndex];
    const autoplay = currentAtt && /^(mp4|webm|mov)$/i.test(currentAtt.fileType);

    openMediaViewer(mediaPhotos, currentIndex, null, messageText, autoplay);
}

function startBalloonVideoPreview(wrapper) {
    if (!wrapper) return;
    const videoSrc = wrapper.dataset.videoSrc;
    if (!videoSrc) return;
    const rect = wrapper.getBoundingClientRect();
    wrapper.style.width = rect.width + 'px';
    wrapper.style.height = rect.height + 'px';
    const img = wrapper.querySelector('.message-attachment-image');
    if (img) img.style.display = 'none';

    let video = wrapper.querySelector('video');
    if (!video) {
        video = document.createElement('video');
        video.className = 'message-attachment-video';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.src = videoSrc;
        wrapper.appendChild(video);
    }
    video.style.display = 'block';
    video.play().catch(() => {});
}

function stopBalloonVideoPreview(wrapper) {
    if (!wrapper) return;
    const video = wrapper.querySelector('video');
    if (video) {
        video.pause();
        video.style.display = 'none';
    }
    const img = wrapper.querySelector('.message-attachment-image');
    if (img) img.style.display = '';
    wrapper.style.width = '';
    wrapper.style.height = '';
}

function formatVideoDuration(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ── Shared User Info Display ────────────────────────────────────────────────

let userInfoPhotos = [];
let userInfoCurrentPhotoIndex = 0;
let userInfoCurrentUserId = null;
let userInfoCurrentBodyId = null;

function isUserOnline(lastSeen) {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins < 5;
}

function displayUserInfo(user, bodyId) {
    const body = document.getElementById(bodyId);

    if (!body) {
        console.error('Element body not found:', bodyId);
        return;
    }

    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    const lastSeen = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
    const isOnline = user.lastSeen ? isUserOnline(user.lastSeen) : false;
    const avatarColor = getAvatarColorForUser(user.id);

    // Store photos globally
    userInfoPhotos = user.photos || [];
    userInfoCurrentPhotoIndex = 0;
    userInfoCurrentUserId = user.id;
    userInfoCurrentBodyId = bodyId;

    // Get current photo
    const currentPhoto = userInfoPhotos.length > 0 ? userInfoPhotos[userInfoCurrentPhotoIndex] : null;
    const photoUrl = currentPhoto ? getPreviewUrl(currentPhoto.id, currentPhoto.fileType) : null;
    const hasMultiplePhotos = userInfoPhotos.length > 1;

    let html = `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper_${user.id}">
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-left" onclick="event.stopPropagation(); navigateUserInfoPhoto(-1)" title="Previous photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m14 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <div class="user-info-avatar" id="userInfoAvatar_${user.id}">
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg_${user.id}">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(name)}</span>`}
                </div>
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-right" onclick="event.stopPropagation(); navigateUserInfoPhoto(1)" title="Next photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m10 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            ${hasMultiplePhotos ? `
            <div class="user-profile-avatar-pagination">
                ${userInfoPhotos.map((photo, index) => `
                    <button class="user-profile-avatar-pagination-dot ${index === userInfoCurrentPhotoIndex ? 'active' : ''}" 
                            onclick="event.stopPropagation(); switchUserInfoPhoto(${index})" 
                            title="Photo ${index + 1}"></button>
                `).join('')}
            </div>
            ` : ''}
        </div>
        <div class="user-info-name">${escapeHtml(name)}</div>
        <div class="user-info-username"><a href="/${encodeURIComponent(username)}" class="info-link" target="_blank" rel="noopener noreferrer">${escapeHtml(username)}</a></div>
    `;

    // Status section
    if (user.lastSeen) {
        html += `
            <div class="user-info-section">
                <div class="user-info-section-title">Status</div>
                <div class="user-info-status">
                    <span class="user-info-status-indicator ${isOnline ? '' : 'offline'}"></span>
                    <span>${isOnline ? 'Online' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'}</span>
                </div>
            </div>
        `;
    }

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
                    <span>User ID: <a href="/${user.id}" class="info-link" target="_blank" rel="noopener noreferrer">${user.id || 'N/A'}</a></span>
                </div>
                ${lastSeen ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Last seen: ${lastSeen}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    body.innerHTML = html;

    // Add click handler to avatar after HTML is inserted
    const avatar = document.getElementById(`userInfoAvatar_${user.id}`);
    if (avatar && photoUrl) {
        avatar.addEventListener('click', function(event) {
            if (event.target.closest('.user-profile-avatar-chevron')) {
                return;
            }
            openUserInfoViewer();
        });
    }
}

function navigateUserInfoPhoto(direction) {
    if (userInfoPhotos.length <= 1) return;

    userInfoCurrentPhotoIndex += direction;
    if (userInfoCurrentPhotoIndex < 0) {
        userInfoCurrentPhotoIndex = userInfoPhotos.length - 1;
    } else if (userInfoCurrentPhotoIndex >= userInfoPhotos.length) {
        userInfoCurrentPhotoIndex = 0;
    }

    updateUserInfoAvatarDisplay();
}

function switchUserInfoPhoto(index) {
    if (index < 0 || index >= userInfoPhotos.length) return;
    userInfoCurrentPhotoIndex = index;
    updateUserInfoAvatarDisplay();
}

function updateUserInfoAvatarDisplay() {
    if (!userInfoCurrentUserId) return;

    const avatar = document.getElementById(`userInfoAvatar_${userInfoCurrentUserId}`);
    const avatarImg = document.getElementById(`userInfoAvatarImg_${userInfoCurrentUserId}`);
    const currentPhoto = userInfoPhotos[userInfoCurrentPhotoIndex];

    if (!avatar) return;

    if (currentPhoto && avatarImg) {
        avatarImg.src = getPreviewUrl(currentPhoto.id, currentPhoto.fileType);
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = getPreviewUrl(currentPhoto.id, currentPhoto.fileType);
        img.alt = '';
        img.id = `userInfoAvatarImg_${userInfoCurrentUserId}`;
        avatar.innerHTML = '';
        avatar.appendChild(img);
    }

    // Update pagination dots
    const body = document.getElementById(userInfoCurrentBodyId);
    if (body) {
        const dots = body.querySelectorAll('.user-profile-avatar-pagination-dot');
        dots.forEach((dot, index) => {
            if (index === userInfoCurrentPhotoIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
}

function openUserInfoViewer() {
    if (userInfoPhotos.length === 0) return;

    openMediaViewer(userInfoPhotos, userInfoCurrentPhotoIndex, (newIndex) => {
        userInfoCurrentPhotoIndex = newIndex;
        updateUserInfoAvatarDisplay();
    });
}

function saveBtnHTML(id, onclick) {
    return `<button class="group-name-save-btn" id="${id}" style="display: none;" onclick="${onclick}" title="Save">${checkmarkSaveIcon}${checkmarkSaveIconSaving}</button>`;
}