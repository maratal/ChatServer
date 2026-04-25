// Track the open recent-media picker tied to the message formatter.
let activeMessageInputMediaPickerCleanup = null;

// Close the active recent-media picker used by the link formatter.
function closeMessageInputMediaPicker() {
    if (!activeMessageInputMediaPickerCleanup) return;

    const cleanup = activeMessageInputMediaPickerCleanup;
    activeMessageInputMediaPickerCleanup = null;
    cleanup();
}

// Capture the current textarea selection before opening menus or popups.
function getMessageInputSelectionSnapshot() {
    const messageInput = getMessageInputElement();
    if (!messageInput) return null;

    const currentValue = messageInput.value;
    const selectionStart = messageInput.selectionStart ?? currentValue.length;
    const selectionEnd = messageInput.selectionEnd ?? selectionStart;

    return {
        selectionStart,
        selectionEnd,
        selectedText: currentValue.slice(selectionStart, selectionEnd)
    };
}

// Read the current textarea value and selection, optionally using a captured snapshot.
function getMessageInputSelectionState(selectionSnapshot = null) {
    const messageInput = getMessageInputElement();
    if (!messageInput) return null;

    const currentValue = messageInput.value;
    const selectionStart = selectionSnapshot?.selectionStart ?? messageInput.selectionStart ?? currentValue.length;
    const selectionEnd = selectionSnapshot?.selectionEnd ?? messageInput.selectionEnd ?? selectionStart;

    return {
        messageInput,
        currentValue,
        selectionStart,
        selectionEnd
    };
}

// Replace the textarea value and restore the requested selection.
function updateMessageInputSelection(value, selectionStart, selectionEnd) {
    const messageInput = getMessageInputElement();
    if (!messageInput) return;

    messageInput.value = value;
    messageInput.focus();
    messageInput.setSelectionRange(selectionStart, selectionEnd);
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// Replace the current or captured selection with one final markup string.
function replaceMessageInputSelection(replacement, selectionSnapshot = null) {
    const selectionState = getMessageInputSelectionState(selectionSnapshot);
    if (!selectionState) return;

    const replacementStart = selectionSnapshot?.replacementStart ?? selectionState.selectionStart;
    const replacementEnd = selectionSnapshot?.replacementEnd ?? selectionState.selectionEnd;
    const nextValue = selectionState.currentValue.slice(0, replacementStart) + replacement + selectionState.currentValue.slice(replacementEnd);
    const nextCursorPosition = replacementStart + replacement.length;

    updateMessageInputSelection(nextValue, nextCursorPosition, nextCursorPosition);
}

// Find a matching inline marker pair on the current line that encloses the selection.
function getMessageInputMarkerContext(marker, selectionSnapshot = null) {
    const selectionState = getMessageInputSelectionState(selectionSnapshot);
    if (!selectionState) return null;

    const lineStart = selectionState.currentValue.lastIndexOf('\n', Math.max(0, selectionState.selectionStart - 1)) + 1;
    const lineEndIndex = selectionState.currentValue.indexOf('\n', selectionState.selectionEnd);
    const lineEnd = lineEndIndex === -1 ? selectionState.currentValue.length : lineEndIndex;
    const lineText = selectionState.currentValue.slice(lineStart, lineEnd);
    const relativeSelectionStart = selectionState.selectionStart - lineStart;
    const relativeSelectionEnd = selectionState.selectionEnd - lineStart;
    const markerPositions = [];
    let searchIndex = 0;

    while (true) {
        const markerIndex = lineText.indexOf(marker, searchIndex);
        if (markerIndex === -1) break;
        markerPositions.push(markerIndex);
        searchIndex = markerIndex + marker.length;
    }

    for (let index = 0; index + 1 < markerPositions.length; index += 2) {
        const openingIndex = markerPositions[index];
        const closingIndex = markerPositions[index + 1];
        const contentStart = openingIndex + marker.length;

        if (relativeSelectionStart >= contentStart && relativeSelectionEnd <= closingIndex) {
            return {
                type: 'marker',
                marker,
                start: lineStart + openingIndex,
                end: lineStart + closingIndex + marker.length,
                contentStart: lineStart + contentStart,
                contentEnd: lineStart + closingIndex,
                content: lineText.slice(contentStart, closingIndex)
            };
        }
    }

    return null;
}

// Find a popup or embed tag that encloses the current selection.
function getMessageInputTagContext(tagNames, selectionSnapshot = null) {
    const selectionState = getMessageInputSelectionState(selectionSnapshot);
    if (!selectionState) return null;

    const names = Array.isArray(tagNames) ? tagNames : [tagNames];

    for (const tagName of names) {
        const tagPattern = new RegExp(`<${tagName}(\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
        let match;

        while ((match = tagPattern.exec(selectionState.currentValue)) !== null) {
            const fullMatch = match[0];
            const start = match.index;
            const openTagEndOffset = fullMatch.indexOf('>') + 1;
            const closeTagStartOffset = fullMatch.lastIndexOf(`</${tagName}>`);
            const contentStart = start + openTagEndOffset;
            const contentEnd = start + closeTagStartOffset;

            if (selectionState.selectionStart >= contentStart && selectionState.selectionEnd <= contentEnd) {
                return {
                    type: 'tag',
                    tagName,
                    start,
                    end: start + fullMatch.length,
                    contentStart,
                    contentEnd,
                    content: match[2]
                };
            }
        }
    }

    return null;
}

// Read the active popup or embed tag around the selection, if one exists.
function getMessageInputLinkContext(selectionSnapshot = null) {
    return getMessageInputTagContext(['popup', 'embed'], selectionSnapshot);
}

// Remove an active marker or tag wrapper while keeping the inner text selected.
function unwrapMessageInputFormat(context, selectionSnapshot = null) {
    const selectionState = getMessageInputSelectionState(selectionSnapshot);
    if (!selectionState || !context) return;

    const prefixLength = context.contentStart - context.start;
    const nextSelectionStart = Math.max(context.start, selectionState.selectionStart - prefixLength);
    const nextSelectionEnd = Math.max(nextSelectionStart, selectionState.selectionEnd - prefixLength);
    const nextValue = selectionState.currentValue.slice(0, context.start) + context.content + selectionState.currentValue.slice(context.end);

    updateMessageInputSelection(nextValue, nextSelectionStart, nextSelectionEnd);
}

// Wrap the current selection with a prefix and suffix pair.
function wrapMessageInputSelection(prefix, suffix) {
    const messageInput = getMessageInputElement();
    if (!messageInput) return;

    const currentValue = messageInput.value;
    const selectionStart = messageInput.selectionStart ?? currentValue.length;
    const selectionEnd = messageInput.selectionEnd ?? selectionStart;
    const selectedText = currentValue.slice(selectionStart, selectionEnd);
    const nextValue = currentValue.slice(0, selectionStart) + prefix + selectedText + suffix + currentValue.slice(selectionEnd);
    const nextSelectionStart = selectionStart + prefix.length;
    const nextSelectionEnd = nextSelectionStart + selectedText.length;

    updateMessageInputSelection(nextValue, nextSelectionStart, nextSelectionEnd);
}

// Apply inline bold, italic, or strike markers to the current selection.
function applyMessageInputFormat(action) {
    const marker = action === 'bold'
        ? '**'
        : action === 'italic'
        ? '_'
        : action === 'strike'
        ? '~~'
        : null;
    if (!marker) return;

    const activeMarkerContext = getMessageInputMarkerContext(marker);
    if (activeMarkerContext) {
        unwrapMessageInputFormat(activeMarkerContext);
        return;
    }

    wrapMessageInputSelection(marker, marker);
}

// Fallback helper for inserting raw popup or embed tags around a selection.
function applyMessageInputLinkFormat(action) {
    if (action !== 'embed' && action !== 'popup') return;
    wrapMessageInputSelection(`<${action}>`, `</${action}>`);
}

// Build the relative upload URL inserted into popup and embed tags.
function getMessageInputRecentMediaLink(media) {
    if (!media?.id || !media?.fileType) return null;
    return getUploadUrl(media.id, media.fileType);
}

// Extract the visible label from an existing popup body.
function getMessageInputPopupLabelFromContent(content) {
    const trimmedContent = (content ?? '').trim();
    const markdownMatch = trimmedContent.match(/^\[([^\]]+)\]\((?:https?:\/\/[^\s)]+|www\.[^\s)]+|\/uploads\/[^\s)]+)\)$/i);
    return markdownMatch ? markdownMatch[1] : trimmedContent;
}

// Derive a popup label from the captured selection, with a safe fallback.
function getMessageInputPopupLabel(selectionSnapshot) {
    const rawLabel = (selectionSnapshot?.existingPopupLabel ?? selectionSnapshot?.selectedText ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[\[\]]/g, '');

    return rawLabel || 'Media';
}

// Create the final embed or popup markup for a chosen recent-media item.
function createMessageInputRecentMediaMarkup(action, media, selectionSnapshot) {
    const relativeLink = getMessageInputRecentMediaLink(media);
    if (!relativeLink) return null;

    if (action === 'embed') {
        return `<embed>${relativeLink}</embed>`;
    }

    if (action === 'popup') {
        return `<popup>[${getMessageInputPopupLabel(selectionSnapshot)}](${relativeLink})</popup>`;
    }

    return null;
}

// Place the recent-media picker beside the link button without leaving the viewport.
function positionMessageInputMediaPicker(popupElement, anchorElement) {
    const anchorRect = anchorElement.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const gap = 8;

    let left = anchorRect.right + gap;
    if (left + popupRect.width > window.innerWidth - 10) {
        left = anchorRect.left - popupRect.width - gap;
    }
    if (left < 10) {
        left = Math.max(10, window.innerWidth - popupRect.width - 10);
    }

    let top = anchorRect.top;
    if (top + popupRect.height > window.innerHeight - 10) {
        top = window.innerHeight - popupRect.height - 10;
    }
    if (top < 10) {
        top = 10;
    }

    popupElement.style.left = `${left}px`;
    popupElement.style.top = `${top}px`;
}

// Build one clickable recent-media tile for the link picker.
function createMessageInputMediaPickerItem(media, action, selectionSnapshot) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-input-media-picker-item';

    const isImage = /^(jpg|jpeg|png|gif|webp)$/i.test(media.fileType);
    const isVideo = /^(mp4|webm|mov)$/i.test(media.fileType);

    if (isImage || isVideo) {
        const image = document.createElement('img');
        image.alt = 'Recent media';
        image.src = isVideo ? getVideoPreviewUrl(media.id) : getPreviewUrl(media.id, media.fileType);
        button.appendChild(image);
    } else {
        const fallback = document.createElement('div');
        fallback.className = 'message-input-media-picker-item-fallback';
        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.234 20.252 21 12.3"></path><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"></path></svg>';
        button.appendChild(fallback);
    }

    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const markup = createMessageInputRecentMediaMarkup(action, media, selectionSnapshot);
        if (!markup) return;

        replaceMessageInputSelection(markup, selectionSnapshot);
        closeMessageInputMediaPicker();
    });

    return button;
}

// Open the recent-media picker and populate it for embed or popup insertion.
async function openMessageInputRecentMediaPicker(action, anchorElement, selectionSnapshot) {
    closeMessageInputMediaPicker();
    if (!anchorElement) return;

    const popupElement = document.createElement('div');
    popupElement.className = 'message-input-media-picker';
    popupElement.innerHTML = `
        <div class="message-input-media-picker-header">${action === 'embed' ? 'Embed' : 'Popup'} from recents</div>
        <div class="message-input-media-picker-grid">
            <div class="message-input-media-picker-status">Loading...</div>
        </div>
    `;
    document.body.appendChild(popupElement);
    positionMessageInputMediaPicker(popupElement, anchorElement);

    const handleMouseDown = (event) => {
        if (!popupElement.contains(event.target) && !anchorElement.contains(event.target)) {
            closeMessageInputMediaPicker();
        }
    };

    const handleResize = () => {
        if (document.body.contains(popupElement)) {
            positionMessageInputMediaPicker(popupElement, anchorElement);
        }
    };

    const cleanup = () => {
        document.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('resize', handleResize);
        if (document.body.contains(popupElement)) {
            popupElement.remove();
        }
    };

    activeMessageInputMediaPickerCleanup = cleanup;
    setTimeout(() => {
        if (activeMessageInputMediaPickerCleanup === cleanup) {
            document.addEventListener('mousedown', handleMouseDown);
        }
    }, 0);
    window.addEventListener('resize', handleResize);

    try {
        const mediaItems = recentMediaItems.length > 0
            ? recentMediaItems
            : await apiGetRecentMedia(0, RECENTS_PAGE_SIZE);

        if (recentMediaItems.length === 0) {
            recentMediaItems = mediaItems;
            hasMoreRecents = mediaItems.length === RECENTS_PAGE_SIZE;
        }

        if (activeMessageInputMediaPickerCleanup !== cleanup || !document.body.contains(popupElement)) {
            return;
        }

        const grid = popupElement.querySelector('.message-input-media-picker-grid');
        grid.innerHTML = '';

        if (mediaItems.length === 0) {
            grid.innerHTML = '<div class="message-input-media-picker-status">No recent media</div>';
        } else {
            mediaItems.forEach((media) => {
                grid.appendChild(createMessageInputMediaPickerItem(media, action, selectionSnapshot));
            });
        }

        positionMessageInputMediaPicker(popupElement, anchorElement);
    } catch (error) {
        if (activeMessageInputMediaPickerCleanup !== cleanup || !document.body.contains(popupElement)) {
            return;
        }

        const grid = popupElement.querySelector('.message-input-media-picker-grid');
        grid.innerHTML = '<div class="message-input-media-picker-status">Can\'t load recents</div>';
    }
}

// Open the link action menu and route the chosen mode into the recent-media picker.
function handleMessageInputLinkButton(event) {
    event.preventDefault();
    event.stopPropagation();
    closeMessageInputMediaPicker();

    const button = event.currentTarget || event.target.closest('button');
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const selectionSnapshot = getMessageInputSelectionSnapshot();
    const activeLinkContext = getMessageInputLinkContext(selectionSnapshot);
    if (activeLinkContext) {
        selectionSnapshot.replacementStart = activeLinkContext.start;
        selectionSnapshot.replacementEnd = activeLinkContext.end;

        if (activeLinkContext.tagName === 'popup') {
            selectionSnapshot.existingPopupLabel = getMessageInputPopupLabelFromContent(activeLinkContext.content);
        }
    }

    showContextMenu({
        items: [
            { id: 'embed', label: 'Embed', icon: formatEmbedIcon },
            { id: 'popup', label: 'Popup', icon: formatPopupIcon }
        ],
        x: rect.right + 8,
        y: rect.bottom,
        anchor: 'bottom-left',
        highlightElement: button,
        onAction: (action) => openMessageInputRecentMediaPicker(action, button, selectionSnapshot)
    });
}

// Create the formatter UI controller used by the message input resize logic.
function createMessageInputFormattingController(options = {}) {
    const {
        messageInput,
        messageInputFormatButtons,
        messageInputBoldButton,
        messageInputItalicButton,
        messageInputStrikeButton,
        messageInputLinkButton,
        attachButton
    } = options;

    // Measure the minimum input height needed to reveal the formatter buttons.
    function getMessageInputFormattingRevealHeight() {
        if (!messageInputFormatButtons || !attachButton) return Infinity;

        const fallbackButtonHeight = 24;
        const fallbackGap = 6;
        const buttonCount = messageInputFormatButtons.childElementCount;
        const fallbackToolbarHeight = buttonCount === 0
            ? 0
            : buttonCount * fallbackButtonHeight + (buttonCount - 1) * fallbackGap;
        const toolbarHeight = messageInputFormatButtons.scrollHeight || fallbackToolbarHeight;
        const attachHeight = attachButton.getBoundingClientRect().height || 36;
        return toolbarHeight + attachHeight + 12;
    }

    // Show or hide the formatter stack based on the current textarea height.
    function updateMessageInputFormattingButtons() {
        if (!messageInput || !messageInputFormatButtons) return;

        const shouldShow = messageInput.getBoundingClientRect().height >= getMessageInputFormattingRevealHeight();
        messageInputFormatButtons.classList.toggle('is-visible', shouldShow);
        messageInputFormatButtons.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }

    // Sync the active-state styling with the formatting around the current selection.
    function updateMessageInputFormatButtonStates() {
        messageInputBoldButton?.classList.toggle('is-active', Boolean(getMessageInputMarkerContext('**')));
        messageInputItalicButton?.classList.toggle('is-active', Boolean(getMessageInputMarkerContext('_')));
        messageInputStrikeButton?.classList.toggle('is-active', Boolean(getMessageInputMarkerContext('~~')));
        messageInputLinkButton?.classList.toggle('is-active', Boolean(getMessageInputLinkContext()));
    }

    // Delay the active-state refresh until the selection change has settled.
    function queueMessageInputFormatButtonStateUpdate() {
        setTimeout(updateMessageInputFormatButtonStates, 0);
    }

    return {
        updateMessageInputFormattingButtons,
        updateMessageInputFormatButtonStates,
        queueMessageInputFormatButtonStateUpdate
    };
}