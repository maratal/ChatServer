// Media Viewer - Shared viewer functionality for avatars/photos/videos

const videoFileTypes = /^(mp4|webm|mov)$/i;

let mediaViewerPhotoIndex = 0;
let mediaViewerPhotos = [];
let mediaViewerCurrentIndex = 0;
let mediaViewerUpdateCallback = null;
let mediaViewerText = null;
let mediaViewerAutoplay = false;
let mediaViewerDelayTimer = null;

function isVideoAttachment(item) {
    return videoFileTypes.test(item.fileType);
}

function createMediaViewerHTML(photos, currentIndex, viewerId = 'mediaViewer', text = null) {
    const hasMultiplePhotos = photos.length > 1;
    
    return `
        <div class="media-viewer-content">
            <div class="media-viewer-top-bar">
                <div class="media-viewer-top-bar-left"></div>
                <div class="media-viewer-top-bar-center">
                    <div class="media-viewer-message-preview" id="${viewerId}MessagePreview"></div>
                    <div class="media-viewer-date" id="${viewerId}Date"></div>
                </div>
                <div class="media-viewer-top-bar-right">
                    <button class="media-viewer-action-btn" id="${viewerId}Download" onclick="downloadMediaViewerCurrent()" title="Download">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    <button class="media-viewer-close" onclick="closeMediaViewer()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="media-viewer-content-container">
                ${hasMultiplePhotos ? `
                <button class="media-viewer-chevron media-viewer-chevron-left" onclick="navigateMediaViewerPhoto(-1)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m14 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <div class="media-viewer-media" id="${viewerId}Media"></div>
                ${hasMultiplePhotos ? `
                <button class="media-viewer-chevron media-viewer-chevron-right" onclick="navigateMediaViewerPhoto(1)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m10 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            <div class="media-viewer-bottom-bar">
                ${hasMultiplePhotos ? `
                <div class="media-viewer-pagination">
                    ${photos.map((photo, index) => `
                        <button class="media-viewer-pagination-dot ${index === currentIndex ? 'active' : ''}" 
                                onclick="switchMediaViewerPhoto(${index})"></button>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function openMediaViewer(photos, currentIndex, updateCallback = null, text = null, autoplay = false) {
    if (!photos || photos.length === 0) return;
    
    mediaViewerPhotos = photos;
    mediaViewerCurrentIndex = currentIndex;
    mediaViewerPhotoIndex = currentIndex;
    mediaViewerUpdateCallback = updateCallback;
    mediaViewerText = text;
    mediaViewerAutoplay = autoplay;
    
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer';
    viewer.id = 'mediaViewer';
    viewer.innerHTML = createMediaViewerHTML(photos, currentIndex, 'mediaViewer', text);
    
    document.body.appendChild(viewer);
    updateMediaViewer();
    
    // Close on background click (but not on content elements)
    viewer.addEventListener('click', (e) => {
        // Don't close if clicking on interactive elements
        if (e.target.closest('button') || e.target.closest('img') || e.target.closest('video') || e.target.closest('.media-viewer-top-bar') || e.target.closest('.media-viewer-bottom-bar')) {
            return;
        }
        
        // Close if clicking on viewer background or empty space in media container
        const mediaContainer = viewer.querySelector('.media-viewer-content-container');
        if (e.target === viewer || (mediaContainer && e.target === mediaContainer)) {
            closeMediaViewer();
        }
    });
    
    // Setup keyboard navigation (use capture phase to handle before other handlers)
    document.addEventListener('keydown', handleMediaViewerKeyboard, true);
}

function updateMediaViewer() {
    const mediaContainer = document.getElementById('mediaViewerMedia');
    const messagePreview = document.getElementById('mediaViewerMessagePreview');
    const dateElement = document.getElementById('mediaViewerDate');
    const currentPhoto = mediaViewerPhotos[mediaViewerPhotoIndex];
    
    if (!mediaContainer || !currentPhoto) return;
    
    // Cancel any pending delayed playback
    if (mediaViewerDelayTimer) {
        clearTimeout(mediaViewerDelayTimer);
        mediaViewerDelayTimer = null;
    }
    
    // Pause any existing video before switching
    const existingVideo = mediaContainer.querySelector('video');
    if (existingVideo) {
        existingVideo.pause();
    }
    
    const fileUrl = currentPhoto._blobUrl || `/uploads/${currentPhoto.id.toLowerCase()}.${currentPhoto.fileType}`;
    
    if (isVideoAttachment(currentPhoto)) {
        mediaContainer.innerHTML = `<video class="media-viewer-video" controls src="${fileUrl}"></video>`;
        const video = mediaContainer.querySelector('video');
        if (mediaViewerAutoplay) {
            // Instant playback when opened from outside
            video.play().catch(() => {});
        } else if (mediaViewerPhotos.length > 1) {
            // Delayed playback when navigating within media viewer
            mediaViewerDelayTimer = setTimeout(() => {
                video.play().catch(() => {});
                mediaViewerDelayTimer = null;
            }, 1000);
        }
    } else {
        mediaContainer.innerHTML = `<img class="media-viewer-image" src="${fileUrl}" alt="">`;
    }
    mediaViewerAutoplay = false;
    
    // Update message preview text in top bar
    if (messagePreview) {
        if (mediaViewerText) {
            messagePreview.textContent = mediaViewerText;
            messagePreview.style.display = '';
        } else {
            messagePreview.textContent = '';
            messagePreview.style.display = 'none';
        }
    }
    
    // Format date and time
    if (currentPhoto.createdAt && dateElement) {
        const date = new Date(currentPhoto.createdAt);
        const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        dateElement.textContent = formattedDate;
    }
    
    // Update pagination dots
    const dots = document.querySelectorAll('.media-viewer-pagination-dot');
    dots.forEach((dot, index) => {
        if (index === mediaViewerPhotoIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Call update callback if provided
    if (mediaViewerUpdateCallback) {
        mediaViewerUpdateCallback(mediaViewerPhotoIndex);
    }
}

function downloadMediaViewerCurrent() {
    const currentPhoto = mediaViewerPhotos[mediaViewerPhotoIndex];
    if (!currentPhoto) return;
    
    const url = currentPhoto._blobUrl || `/uploads/${currentPhoto.id.toLowerCase()}.${currentPhoto.fileType}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPhoto.id}.${currentPhoto.fileType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function navigateMediaViewerPhoto(direction) {
    if (mediaViewerPhotos.length <= 1) return;
    
    mediaViewerPhotoIndex += direction;
    if (mediaViewerPhotoIndex < 0) {
        mediaViewerPhotoIndex = mediaViewerPhotos.length - 1;
    } else if (mediaViewerPhotoIndex >= mediaViewerPhotos.length) {
        mediaViewerPhotoIndex = 0;
    }
    
    mediaViewerCurrentIndex = mediaViewerPhotoIndex;
    updateMediaViewer();
}

function switchMediaViewerPhoto(index) {
    if (index < 0 || index >= mediaViewerPhotos.length) return;
    mediaViewerPhotoIndex = index;
    mediaViewerCurrentIndex = index;
    updateMediaViewer();
}

function closeMediaViewer() {
    // Cancel any pending delayed playback
    if (mediaViewerDelayTimer) {
        clearTimeout(mediaViewerDelayTimer);
        mediaViewerDelayTimer = null;
    }
    const viewer = document.getElementById('mediaViewer');
    if (viewer) {
        const video = viewer.querySelector('video');
        if (video) video.pause();
        viewer.remove();
    }
    document.removeEventListener('keydown', handleMediaViewerKeyboard, true);
    mediaViewerUpdateCallback = null;
    mediaViewerText = null;
}

function handleMediaViewerKeyboard(e) {
    if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closeMediaViewer();
    } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        navigateMediaViewerPhoto(-1);
    } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        navigateMediaViewerPhoto(1);
    }
}

