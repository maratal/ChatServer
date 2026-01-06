// Message-related global variables
let pendingMessages = new Map(); // Track messages being sent
let selectedAttachments = [];
let attachmentUploads = new Map(); // Map of attachmentId -> { xhr, file, progress }
let attachmentAnimationFrames = new Map(); // Map of attachmentId -> animationFrameId

// Load messages for a chat
async function loadMessages(chatId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch(`/chats/${chatId}/messages?count=50`, {
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
    
    // Check if messages have attachments (by checking for attachment container in DOM)
    const currentHasAttachments = messageElement.querySelector('.message-attachment-container') !== null;
    const prevHasAttachments = prevElement && prevElement.querySelector('.message-attachment-container') !== null;
    const nextHasAttachments = nextElement && nextElement.querySelector('.message-attachment-container') !== null;
    
    // Messages should be grouped if same author AND within 10 minutes AND no attachments
    const shouldGroupWithPrev = sameAuthorAsPrev && !timeGapWithPrev && 
        !currentHasAttachments && !prevHasAttachments;
    const shouldGroupWithNext = sameAuthorAsNext && !timeGapWithNext && 
        !currentHasAttachments && !nextHasAttachments;
    
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
    
    // Add date headers and render messages
    let currentDate = null;
    
    messages.forEach((message) => {
        const messageDate = new Date(message.createdAt);
        const messageDateString = messageDate.toDateString();
        
        // Add date header if date changed
        if (currentDate !== messageDateString) {
            // Add date header (including for the first message)
            const dateHeader = createDateHeader(formatDateHeader(messageDate), messageDate);
            messagesContainer.appendChild(dateHeader);
            currentDate = messageDateString;
        }
        
        // Render message without groupPosition (will be set after rendering)
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Apply grouping to all rendered messages
    const messageElements = Array.from(messagesContainer.children).filter(el => el.classList.contains('message-bubble'));
    messageElements.forEach((messageElement, index) => {
        updateSingleMessageGrouping(messageElement, index, messageElements);
    });
    
    // Scroll to bottom instantly when loading messages
    setTimeout(() => {
        scrollMessagesToBottom(true); // instant scroll for loading messages
    }, 50);
}

// Create date header element
function createDateHeader(dateString, date) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'date-header';
    const fullDateTime = formatFullDateTime(date);
    headerDiv.innerHTML = `<span class="date-header-text" title="${escapeHtml(fullDateTime)}">${dateString}</span>`;
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

// Format full date and time for tooltips
function formatFullDateTime(date) {
    const dateObj = new Date(date);
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
    const authorMainPhoto = mainPhotoForUser(author);
    
    // Format time
    const messageDate = new Date(message.createdAt);
    const messageTime = messageDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    const fullDateTime = formatFullDateTime(message.createdAt);
    
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
    
    const avatarContent = authorMainPhoto 
        ? `<img src="/uploads/${authorMainPhoto.id}.${authorMainPhoto.fileType}" alt="" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : `<span class="message-avatar-initials">${authorInitials}</span>`;
    
    // Handle attachments
    const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0;
    const hasMultipleAttachments = hasAttachments && message.attachments.length > 1;
    const messageId = message.id || message.localId;
    
    let attachmentHTML = '';
    if (hasAttachments) {
        // Filter out invalid attachments (must have id and fileType)
        const validAttachments = message.attachments.filter(att => att && att.id && att.fileType);
        
        if (validAttachments.length === 0) {
            console.warn('No valid attachments found for message:', messageId, 'attachments:', message.attachments);
        } else {
            const firstAttachment = validAttachments[0];
            const hasMultipleValidAttachments = validAttachments.length > 1;
            
            const isImage = firstAttachment.fileType.match(/^(jpg|jpeg|png|gif|webp)$/i);
            const isVideo = firstAttachment.fileType.match(/^(mp4|webm|mov)$/i);
            
            if (!isImage && !isVideo) {
                console.warn('Unknown attachment type:', firstAttachment.fileType, 'for message:', messageId);
            }
            
            attachmentHTML = `
                <div class="message-attachment-container" data-message-id="${messageId}" onclick="openMessageAttachmentViewer('${messageId}')" style="cursor: pointer;">
                    ${hasMultipleValidAttachments ? `
                    <button class="message-attachment-chevron message-attachment-chevron-left" onclick="event.stopPropagation(); navigateMessageAttachment('${messageId}', -1)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m15 18-6-6 6-6"></path>
                        </svg>
                    </button>
                    ` : ''}
                    ${isImage ? `
                    <img class="message-attachment-image" src="/uploads/${firstAttachment.id}.${firstAttachment.fileType}" alt="Attachment">
                    ` : isVideo ? `
                    <video class="message-attachment-video" controls onclick="event.stopPropagation();">
                        <source src="/uploads/${firstAttachment.id}.${firstAttachment.fileType}" type="video/${firstAttachment.fileType}">
                    </video>
                    ` : ''}
                    ${hasMultipleValidAttachments ? `
                    <button class="message-attachment-chevron message-attachment-chevron-right" onclick="event.stopPropagation(); navigateMessageAttachment('${messageId}', 1)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                    </button>
                    ` : ''}
                    ${hasMultipleValidAttachments ? `
                    <div class="message-attachment-pagination" onclick="event.stopPropagation();">
                        ${validAttachments.map((att, index) => `
                            <button class="message-attachment-pagination-dot ${index === 0 ? 'active' : ''}" 
                                    onclick="event.stopPropagation(); switchMessageAttachment('${messageId}', ${index})"></button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            `;
            
            // Store valid attachments for navigation
            messageDiv.dataset.attachments = JSON.stringify(validAttachments);
        }
    }
    
    messageDiv.innerHTML = `
        <span class="message-avatar-small" ${avatarDataAttrs}>
            ${avatarContent}
        </span>
        <div class="message-content-wrapper">
            ${(isGroupChat && !isOwnMessage) ? `<span class="message-author-name">${escapeHtml(authorName)}</span>` : ''}
            <div class="message-content ${hasAttachments ? 'has-attachment' : ''}">
                ${hasAttachments ? attachmentHTML : ''}
                ${message.text ? `<div class="message-text">${convertLinksToClickable(message.text)}</div>` : ''}
                <div class="message-timestamp-area">
                    <span class="message-time" title="${escapeHtml(fullDateTime)}">${messageTime}</span>
                    ${statusIcon}
                </div>
            </div>
        </div>
    `;
    
    // Store attachment data for navigation (already set above if valid attachments exist)
    if (hasAttachments && messageDiv.dataset.attachments) {
        messageDiv.dataset.currentAttachmentIndex = '0';
    }
    
    return messageDiv;
}

// Navigate message attachments
function navigateMessageAttachment(messageId, direction) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-bubble');
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

// Switch message attachment
function switchMessageAttachment(messageId, index) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-bubble');
    if (!messageDiv) return;
    
    const attachments = JSON.parse(messageDiv.dataset.attachments || '[]');
    if (index < 0 || index >= attachments.length) return;
    
    const attachment = attachments[index];
    const container = messageDiv.querySelector('.message-attachment-container');
    if (!container) return;
    
    const isImage = attachment.fileType.match(/^(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = attachment.fileType.match(/^(mp4|webm|mov)$/i);
    
    // Find and replace the current image/video element
    const currentMedia = container.querySelector('.message-attachment-image, .message-attachment-video');
    if (currentMedia) {
        if (isImage) {
            const img = document.createElement('img');
            img.className = 'message-attachment-image';
            img.src = `/uploads/${attachment.id}.${attachment.fileType}`;
            img.alt = 'Attachment';
            currentMedia.replaceWith(img);
        } else if (isVideo) {
            const video = document.createElement('video');
            video.className = 'message-attachment-video';
            video.controls = true;
            const source = document.createElement('source');
            source.src = `/uploads/${attachment.id}.${attachment.fileType}`;
            source.type = `video/${attachment.fileType}`;
            video.appendChild(source);
            currentMedia.replaceWith(video);
        }
    }
    
    // Update pagination dots
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

// Open media viewer for message attachments
function openMessageAttachmentViewer(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`)?.closest('.message-bubble');
    if (!messageDiv) return;
    
    const attachments = JSON.parse(messageDiv.dataset.attachments || '[]');
    if (attachments.length === 0) return;
    
    const currentIndex = parseInt(messageDiv.dataset.currentAttachmentIndex || '0');
    
    // Get message text
    const messageTextElement = messageDiv.querySelector('.message-text');
    const messageText = messageTextElement ? messageTextElement.textContent.trim() : null;
    
    // Convert attachments to media viewer format (with createdAt from message)
    const messageCreatedAt = messageDiv.dataset.createdAt;
    const mediaPhotos = attachments.map(att => ({
        id: att.id,
        fileType: att.fileType,
        createdAt: messageCreatedAt // Use message creation date for all attachments
    }));
    
    // Open media viewer with text
    openMediaViewer(mediaPhotos, currentIndex, null, messageText);
}

// Convert links in text to clickable links
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

// Attachment management
// Open attachment file dialog
function openAttachmentDialog() {
    const input = document.getElementById('attachmentInput');
    if (input) {
        input.click();
    }
}

// Handle attachment file selection
function handleAttachmentFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Filter only images and videos
    const mediaFiles = files.filter(file => 
        file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (mediaFiles.length === 0) {
        alert('Please select image or video files');
        return;
    }
    
    // Limit to MAX_ATTACHMENTS total
    const remainingSlots = MAX_ATTACHMENTS - selectedAttachments.length;
    if (remainingSlots <= 0) {
        alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
        return;
    }
    
    const filesToAdd = mediaFiles.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
        const attachmentId = crypto.randomUUID();
        const attachment = {
            id: attachmentId,
            file: file,
            uploaded: false,
            uploadProgress: 0,
            uploading: false
        };
        selectedAttachments.push(attachment);
        
        // Start upload immediately
        uploadAttachment(attachment);
    });
    
    updateAttachmentPreview();
    updateSendButtonState();
    
    // Reset input
    event.target.value = '';
}

// Update attachment preview area
function updateAttachmentPreview() {
    const previewContainer = document.getElementById('attachmentPreviewContainer');
    if (!previewContainer) return;
    
    if (selectedAttachments.length === 0) {
        previewContainer.style.display = 'none';
        return;
    }
    
    previewContainer.style.display = 'flex';
    previewContainer.innerHTML = '';
    
    selectedAttachments.forEach((attachment, index) => {
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-preview-item';
        attachmentDiv.dataset.attachmentId = attachment.id;
        
        const isImage = attachment.file.type.startsWith('image/');
        const isVideo = attachment.file.type.startsWith('video/');
        
        // Create close button first
        const closeButton = document.createElement('button');
        closeButton.className = 'attachment-close-button';
        closeButton.onclick = () => removeAttachment(attachment.id);
        closeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"></path>
                <path d="M6 6l12 12"></path>
            </svg>
        `;
        
        if (attachment.preview) {
            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.src = attachment.preview;
            img.alt = 'Preview';
            attachmentDiv.appendChild(img);
        } else if (isImage) {
            // Create loading div
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'attachment-preview-loading';
            loadingDiv.textContent = 'Loading...';
            attachmentDiv.appendChild(loadingDiv);
            
            // Create img element (hidden initially)
            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.alt = 'Preview';
            img.style.display = 'none';
            attachmentDiv.appendChild(img);
            
            // Load preview
            const reader = new FileReader();
            reader.onload = (e) => {
                attachment.preview = e.target.result;
                img.src = e.target.result;
                img.style.display = 'block';
                loadingDiv.style.display = 'none';
            };
            reader.readAsDataURL(attachment.file);
        } else if (isVideo) {
            const videoIcon = document.createElement('div');
            videoIcon.className = 'attachment-preview-video-icon';
            videoIcon.textContent = '🎥';
            attachmentDiv.appendChild(videoIcon);
        }
        
        // Add close button
        attachmentDiv.appendChild(closeButton);
        
        previewContainer.appendChild(attachmentDiv);
        
        // Update progress if uploading (this will create the progress indicator if needed)
        if (attachment.uploadProgress > 0) {
            updateAttachmentProgressVisual(attachment.id, attachment.uploadProgress);
        }
    });
    
    // Add Plus button if less than MAX_ATTACHMENTS
    if (selectedAttachments.length < MAX_ATTACHMENTS) {
        const plusButton = document.createElement('button');
        plusButton.className = 'attachment-preview-item attachment-plus-button';
        plusButton.onclick = openAttachmentDialog;
        plusButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"></path>
                <path d="M12 5v14"></path>
            </svg>
        `;
        previewContainer.appendChild(plusButton);
    }
}

// Upload a single attachment
async function uploadAttachment(attachment) {
    if (attachment.uploading || attachment.uploaded) return;
    
    attachment.uploading = true;
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        attachment.uploading = false;
        return;
    }
    
    const fileId = crypto.randomUUID();
    const fileType = attachment.file.name.split('.').pop().toLowerCase()
    
    try {
        // Start upload with progress tracking
        let uploadXhr = null;
        const uploadPromise = uploadFileWithProgress(
            '/uploads',
            attachment.file,
            fileId,
            attachment.file.type,
            (progress) => {
                updateAttachmentProgress(attachment.id, progress);
            },
            (xhr) => {
                uploadXhr = xhr;
            }
        );
        
        attachmentUploads.set(attachment.id, {
            xhr: uploadXhr,
            file: attachment.file,
            progress: 0
        });
        
        const response = await uploadPromise;
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }
        
        const uploadedFileName = await response.text();
        const uploadedFileNameParts = uploadedFileName.split('.');
        const uploadedFileId = uploadedFileNameParts.slice(0, -1).join('.');
        const uploadedFileType = uploadedFileNameParts.slice(-1)[0];
        
        // Get image dimensions for preview
        let previewWidth = 300;
        let previewHeight = 200;
        
        if (attachment.file.type.startsWith('image/')) {
            const dimensions = await getImageDimensions(attachment.file);
            previewWidth = dimensions.width;
            previewHeight = dimensions.height;
        }
        
        // Animate the last 25% (from 75% to 100%) smoothly
        const animationDuration = 500; // ms - slow animation for last 25%
        const startProgress = 75;
        animateAttachmentProgressToComplete(attachment.id, startProgress, animationDuration);
        
        // Wait for animation to complete before marking as uploaded
        await new Promise(resolve => {
            setTimeout(() => {
                attachment.uploaded = true;
                attachment.uploading = false;
                attachment.uploadProgress = 100;
                attachment.uploadedId = uploadedFileId;
                attachment.fileType = uploadedFileType;
                attachment.previewWidth = previewWidth;
                attachment.previewHeight = previewHeight;
                attachmentUploads.delete(attachment.id);
                showUploadedCheckmark(attachment.id);
                updateSendButtonState();
                resolve();
            }, animationDuration + 300);
        });
        
    } catch (error) {
        console.error('Error uploading attachment:', error);
        attachment.uploading = false;
        attachmentUploads.delete(attachment.id);
    }
}

// Remove attachment
async function removeAttachment(attachmentId) {
    const attachment = selectedAttachments.find(a => a.id === attachmentId);
    if (!attachment) return;
    
    // Cancel upload if in progress
    const upload = attachmentUploads.get(attachmentId);
    if (upload && upload.xhr) {
        upload.xhr.abort();
        attachmentUploads.delete(attachmentId);
    }
    
    // Cancel any animation in progress
    const animationFrameId = attachmentAnimationFrames.get(attachmentId);
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        attachmentAnimationFrames.delete(attachmentId);
    }
    
    // If attachment is uploaded, delete it from server
    if (attachment.uploaded && attachment.uploadedId && attachment.fileType) {
        try {
            const accessToken = getAccessToken();
            if (accessToken) {
                const fileName = `${attachment.uploadedId}.${attachment.fileType}`;
                await fetch(`/uploads/${encodeURIComponent(fileName)}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
            }
        } catch (error) {
            console.error('Error deleting uploaded file:', error);
        }
    }
    
    selectedAttachments = selectedAttachments.filter(a => a.id !== attachmentId);
    updateAttachmentPreview();
    updateSendButtonState();
}

// Update attachment upload progress visually
function updateAttachmentProgressVisual(attachmentId, progress) {
    const attachmentDiv = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
    if (!attachmentDiv) return;
    
    // Ensure progress indicator exists if uploading
    let progressDiv = attachmentDiv.querySelector('.attachment-upload-progress');
    if (!progressDiv && progress > 0) {
        progressDiv = document.createElement('div');
        progressDiv.className = 'attachment-upload-progress';
        attachmentDiv.appendChild(progressDiv);
    }
    
    if (progressDiv) {
        // Create filled pie chart SVG
        const size = 24;
        const center = size / 2;
        const radius = center - 2;
        const progressAngle = (progress / 100) * 360 - 90; // Start from top, convert to degrees
        
        // Calculate end point of arc
        const endX = center + radius * Math.cos(progressAngle * Math.PI / 180);
        const endY = center + radius * Math.sin(progressAngle * Math.PI / 180);
        
        // Determine if we need to use large arc flag (for > 180 degrees)
        const largeArcFlag = progress > 50 ? 1 : 0;
        
        // Create path for pie slice
        let pathData;
        if (progress === 0) {
            // No progress - show empty circle
            pathData = '';
        } else {
            // Partial pie slice
            pathData = `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
        }
        
        progressDiv.innerHTML = `
            <svg class="attachment-progress-circle" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                <circle class="attachment-progress-bg" cx="${center}" cy="${center}" r="${radius}" fill="hsl(var(--background) / 0.5)"></circle>
                ${pathData ? `<path class="attachment-progress-bar" d="${pathData}" fill="white" filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))"></path>` : ''}
            </svg>
        `;
    }
    
    // Hide progress indicator when complete and show checkmark
    if (progress >= 100 && progressDiv) {
        const div = attachmentDiv.querySelector('.attachment-upload-progress');
        if (div && div.parentNode) {
            div.remove();
        }
        showUploadedCheckmark(attachmentId);
        updateSendButtonState(); // Update send button state when progress completes
    }
}

function showUploadedCheckmark(attachmentId) {
    const attachmentDiv = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
    if (!attachmentDiv) return;
    
    // Don't add checkmark if it already exists
    if (attachmentDiv.querySelector('.attachment-upload-checkmark')) return;
    
    // Create checkmark indicator
    const checkmarkDiv = document.createElement('div');
    checkmarkDiv.className = 'attachment-upload-checkmark';
    checkmarkDiv.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M7 12l3 3 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        </svg>
    `;
    attachmentDiv.appendChild(checkmarkDiv);
}

// Update attachment upload progress (capped at 75% during real upload)
function updateAttachmentProgress(attachmentId, progress) {
    const attachment = selectedAttachments.find(a => a.id === attachmentId);
    if (!attachment) return;
    
    // Cap progress at 75% during real upload
    const cappedProgress = Math.min(progress, 75);
    attachment.uploadProgress = cappedProgress;
    
    updateAttachmentProgressVisual(attachmentId, cappedProgress);
}

// Animate attachment upload progress from current value to 100%
function animateAttachmentProgressToComplete(attachmentId, startProgress, duration) {
    // Cancel any existing animation for this attachment
    const existingFrameId = attachmentAnimationFrames.get(attachmentId);
    if (existingFrameId) {
        cancelAnimationFrame(existingFrameId);
    }
    
    const startTime = Date.now();
    const endProgress = 100;
    const progressRange = endProgress - startProgress;
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Use ease-out easing for smooth animation
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentProgressValue = startProgress + (progressRange * easedProgress);
        
        updateAttachmentProgressVisual(attachmentId, currentProgressValue);
        
        // Update stored progress
        const attachment = selectedAttachments.find(a => a.id === attachmentId);
        if (attachment) {
            attachment.uploadProgress = currentProgressValue;
        }
        
        if (progress < 1) {
            const frameId = requestAnimationFrame(animate);
            attachmentAnimationFrames.set(attachmentId, frameId);
        } else {
            // Animation complete
            attachmentAnimationFrames.delete(attachmentId);
            if (attachment) {
                attachment.uploadProgress = 100;
            }
        }
    };
    
    const frameId = requestAnimationFrame(animate);
    attachmentAnimationFrames.set(attachmentId, frameId);
}

// Update send button state
function updateSendButtonState() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    if (messageInput && sendButton) {
        const hasText = messageInput.value.trim().length > 0;
        const allAttachmentsUploaded = selectedAttachments.length > 0 && selectedAttachments.every(a => a.uploaded);
        
        // Show send button if text is present OR all attachments are uploaded
        if (hasText || allAttachmentsUploaded) {
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
    
    if (!text && selectedAttachments.length === 0) return;
    if (!currentChatId || !currentUser || !currentUser.info.id) return;
    
    // Get uploaded attachments (only send those that are ready)
    const uploadedAttachments = selectedAttachments.filter(a => a.uploaded);
    
    // Determine if we should send only text (attachments exist but not all uploaded)
    const shouldSendAttachments = uploadedAttachments.length > 0 && uploadedAttachments.length === selectedAttachments.length;
    
    const localId = generateLocalId();
    
    // Create message object
    const message = {
        localId: localId,
        chatId: currentChatId,
        authorId: currentUser.info.id,
        text: text,
        createdAt: new Date().toISOString(),
        isVisible: true,
        attachments: shouldSendAttachments ? uploadedAttachments.map(a => ({
            id: a.uploadedId,
            fileType: a.fileType,
            fileSize: a.file.size,
            previewWidth: a.previewWidth,
            previewHeight: a.previewHeight
        })) : [],
        readMarks: [],
        isPending: true
    };
    
    // Clear attachments and input (only clear attachments if we're going to send them)
    if (shouldSendAttachments) {
        selectedAttachments = [];
        attachmentUploads.clear();
        updateAttachmentPreview();
    }
    
    if (text) {
        messageInput.value = '';
        messageInput.style.height = '38px';
    }
    
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

// Upload file with progress tracking
function uploadFileWithProgress(url, file, fileName, contentType, onProgress, onXhrCreated = null) {
    return new Promise((resolve, reject) => {
        const accessToken = getAccessToken();
        const xhr = new XMLHttpRequest();
        
        if (onXhrCreated) {
            onXhrCreated(xhr);
        }
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    ok: true,
                    text: () => Promise.resolve(xhr.responseText)
                });
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });
        
        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });
        
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('File-Name', fileName);
        xhr.setRequestHeader('Content-Type', contentType);
        
        xhr.send(file);
    });
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
    
    // Check if we need to add a date header before this message
    const messageDate = new Date(message.createdAt);
    const messageDateString = messageDate.toDateString();
    
    // Get the last message element to check the date
    const allChildren = Array.from(messagesContainer.children);
    let lastMessage = null;
    for (let i = allChildren.length - 1; i >= 0; i--) {
        const child = allChildren[i];
        if (child.classList.contains('message-bubble')) {
            lastMessage = child;
            break;
        }
    }
    
    // Check if we need to add a date header
    // Only add if there's a previous message and the date is different
    let needsDateHeader = false;
    if (lastMessage) {
        const lastMessageDate = new Date(lastMessage.dataset.createdAt);
        const lastMessageDateString = lastMessageDate.toDateString();
        needsDateHeader = lastMessageDateString !== messageDateString;
    }
    
    // Add date header if needed
    if (needsDateHeader) {
        const dateHeader = createDateHeader(formatDateHeader(messageDate), messageDate);
        messagesContainer.appendChild(dateHeader);
    }
    
    const messageElement = createMessageElement(message);
    
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
    updateMessageGroupingIncremental(messageElement);
    
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
        
        const requestBody = {
            localId: message.localId,
            text: message.text || null,
            isVisible: true
        };
        
        // Add attachments if present
        if (message.attachments && message.attachments.length > 0) {
            requestBody.attachments = message.attachments.map(att => ({
                id: att.id,
                fileType: att.fileType,
                fileSize: att.fileSize,
                previewWidth: att.previewWidth,
                previewHeight: att.previewHeight
            }));
        }
        
        const response = await fetch(`/chats/${message.chatId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
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