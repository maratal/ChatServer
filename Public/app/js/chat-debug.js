// Chat Debug Mode
// Provides debug functionality for testing message sending

// Word arrays for sentence generation
const DEBUG_NOUNS = [
    'cat', 'dog', 'bird', 'fish', 'tree', 'house', 'car', 'book', 'computer', 'phone',
    'coffee', 'pizza', 'music', 'movie', 'game', 'friend', 'family', 'work', 'school', 'beach',
    'mountain', 'river', 'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'guy', 'girl'
];

const DEBUG_VERBS = [
    'run', 'jump', 'fly', 'swim', 'walk', 'talk', 'sing', 'dance', 'play',
    'cook', 'eat', 'drink', 'sleep', 'wake', 'smack', 'slap', 'catch', 'grab', 'push',
    'crash', 'break', 'clean', 'play', 'sing', 'dance',
];

const DEBUG_PRONOUNS = [
    'I', 'you', 'he', 'she', 'it', 'we', 'they', 'this'
];

const DEBUG_ADJECTIVES = [
    'happy', 'sad', 'big', 'small', 'fast', 'slow', 'hot', 'cold', 'bright', 'dark',
    'loud', 'quiet', 'smooth', 'rough', 'soft', 'hard', 'sweet', 'sour', 'fresh', 'old',
    'new', 'young', 'tall', 'short', 'wide', 'narrow', 'thick', 'thin', 'heavy', 'light'
];

const DEBUG_ADVERBS = [
    'quickly', 'slowly', 'carefully', 'easily', 'quietly', 'loudly', 'happily', 'sadly',
    'suddenly', 'finally', 'always', 'never', 'often', 'sometimes', 'usually', 'rarely',
    'very', 'really', 'quite', 'rather', 'almost', 'nearly', 'completely', 'totally',
    'together', 'apart', 'alone', 'side by side', 'in harmony', 'in sync', 'at once', 
    'in unison', 'as one', 'hand in hand', 'back to back', 'face to face'
];

// Debug mode state
let debugTimerId = null;
let debugInterval = null;
let debugMinDuration = null;
let debugMaxDuration = null;

/**
 * Check if debug send mode is active
 */
function isDebugSendModeActive() {
    const input = getMessageInputElement();
    return input && input.dataset.debugSendMode === 'true';
}

/**
 * Check if debug command mode is active
 */
function isInDebugCommandMode() {
    const input = getMessageInputElement();
    return input && input.dataset.debugCommandMode === 'true';
}

/**
 * Set debug send mode state
 */
function setDebugSendMode(active) {
    const input = getMessageInputElement();
    if (input) {
        input.dataset.debugSendMode = active ? 'true' : 'false';
        setDebugCommandMode(active);
    }
}

/**
 * Set debug command mode state
 */
function setDebugCommandMode(active) {
    const input = getMessageInputElement();
    if (input) {
        input.dataset.debugCommandMode = active ? 'true' : 'false';
        // Update placeholder
        if (active) {
            input.placeholder = 'Type a command...';
        } else {
            input.placeholder = 'Type a message...';
        }
    }
}

/**
 * Determine whether to use "a" or "an" based on the following word
 * @param {string} word - The word that follows the article
 * @returns {string} - "a" or "an"
 */
function getArticle(word) {
    if (!word || word.length === 0) {
        return 'a';
    }
    
    const firstChar = word.charAt(0).toLowerCase();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    
    // Use "an" before words starting with a vowel sound
    if (vowels.includes(firstChar)) {
        return 'an';
    }
    
    // Use "a" before words starting with a consonant sound
    return 'a';
}

/**
 * Get the verb form based on subject (add 's'/'es'/'ies' for third person singular)
 * @param {string} verb - The base verb form
 * @param {boolean} isThirdPersonSingular - Whether the subject is third person singular
 * @returns {string} - The verb with appropriate form
 */
function getVerbForm(verb, isThirdPersonSingular) {
    if (!isThirdPersonSingular) {
        return verb;
    }
    
    // Verbs ending in 's', 'x', 'z', 'ch', 'sh' get 'es'
    if (verb.endsWith('s') || verb.endsWith('x') || verb.endsWith('z') || 
        verb.endsWith('ch') || verb.endsWith('sh')) {
        return verb + 'es';
    }
    
    // Verbs ending in 'y' preceded by a consonant change 'y' to 'ies'
    if (verb.endsWith('y')) {
        const beforeY = verb.slice(0, -1);
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        if (beforeY.length > 0 && !vowels.includes(beforeY.charAt(beforeY.length - 1))) {
            return beforeY + 'ies';
        }
    }
    
    // Regular verbs just add 's'
    return verb + 's';
}

/**
 * Check if a pronoun is third person singular
 * @param {string} pronoun - The pronoun (e.g., "he", "she", "it")
 * @returns {boolean} - True if third person singular
 */
function isThirdPersonSingular(pronoun) {
    const thirdPersonSingular = ['he', 'she', 'it'];
    return thirdPersonSingular.includes(pronoun.toLowerCase());
}

/**
 * Generate a single random sentence from word arrays
 */
function generateSingleSentence() {
    const useThe = Math.random() < 0.3; // 30% chance to use "the"
    const usePronoun = Math.random() < 0.4; // 40% chance to use a pronoun instead of article + noun
    const adjective = DEBUG_ADJECTIVES[Math.floor(Math.random() * DEBUG_ADJECTIVES.length)];
    const noun = DEBUG_NOUNS[Math.floor(Math.random() * DEBUG_NOUNS.length)];
    const baseVerb = DEBUG_VERBS[Math.floor(Math.random() * DEBUG_VERBS.length)];
    const adverb = DEBUG_ADVERBS[Math.floor(Math.random() * DEBUG_ADVERBS.length)];
    
    // Determine if we'll use an adjective
    const useAdjective = Math.random() < 0.5; // 50% chance to include adjective
    
    // Get pronoun if using one
    const pronoun = usePronoun ? DEBUG_PRONOUNS[Math.floor(Math.random() * DEBUG_PRONOUNS.length)] : null;
    
    // Determine verb form based on subject
    let verb;
    if (usePronoun) {
        verb = getVerbForm(baseVerb, isThirdPersonSingular(pronoun));
    } else {
        // Article + noun is third person singular (unless plural, but we're not handling plurals for now)
        verb = getVerbForm(baseVerb, true);
    }
    
    // Helper function to get article for a noun (considering adjective if present)
    const getArticleForNoun = (targetNoun, hasAdj) => {
        if (useThe) {
            return 'the';
        }
        // Article should be based on the adjective if present, otherwise the noun
        const wordForArticle = hasAdj ? adjective : targetNoun;
        return getArticle(wordForArticle);
    };
    
    // Randomly choose sentence structure
    const structures = [
        // Article + adjective + noun + verb + adverb
        () => {
            if (usePronoun) {
                return `${pronoun} ${verb} ${adverb}.`;
            }
            const article = getArticleForNoun(noun, useAdjective);
            return useAdjective ? `${article} ${adjective} ${noun} ${verb} ${adverb}.` : `${article} ${noun} ${verb} ${adverb}.`;
        },
        // Article + adjective + noun + verb (no adverb)
        () => {
            if (usePronoun) {
                return `${pronoun} ${verb}.`;
            }
            const article = getArticleForNoun(noun, useAdjective);
            return useAdjective ? `${article} ${adjective} ${noun} ${verb}.` : `${article} ${noun} ${verb}.`;
        },
        // First person: "I verb article adjective noun"
        () => {
            const firstPersonVerb = getVerbForm(baseVerb, false);
            if (usePronoun && pronoun.toLowerCase() === 'i') {
                const article = getArticleForNoun(noun, useAdjective);
                return `I ${firstPersonVerb} ${article} ${useAdjective ? adjective + ' ' : ''}${noun}.`;
            }
            const article = getArticleForNoun(noun, useAdjective);
            return `I ${firstPersonVerb} ${article} ${useAdjective ? adjective + ' ' : ''}${noun}.`;
        },
        // "The noun is adjective"
        () => {
            if (usePronoun) {
                return `${pronoun} is ${adjective}.`;
            }
            return `The ${noun} is ${adjective}.`;
        },
        // Plural: "noun and noun verb [adverb]"
        () => {
            const noun2 = DEBUG_NOUNS[Math.floor(Math.random() * DEBUG_NOUNS.length)];
            const pluralVerb = getVerbForm(baseVerb, false); // Plural subject, no 's'
            if (usePronoun && (pronoun.toLowerCase() === 'we' || pronoun.toLowerCase() === 'they')) {
                return `${pronoun} ${pluralVerb} ${adverb}.`;
            }
            // For plural subjects, determine article for each noun separately
            // Don't use adjective in plural structure, and determine article directly from noun
            const article1 = useThe ? 'the' : getArticle(noun);
            const article2 = useThe ? 'the' : getArticle(noun2);
            return `${article1} ${noun} and ${article2} ${noun2} ${pluralVerb} ${adverb}.`;
        }
    ];
    
    const structure = structures[Math.floor(Math.random() * structures.length)];
    return structure();
}

/**
 * Generate a random message composed of 1-5 sentences
 */
function generateDebugSentence() {
    // Randomly decide how many sentences to generate (1-5)
    const numSentences = Math.floor(Math.random() * 5) + 1;
    
    const sentences = [];
    for (let i = 0; i < numSentences; i++) {
        sentences.push(generateSingleSentence());
    }
    
    // Join sentences with spaces (they already have periods)
    return sentences.join(' ');
}

/**
 * Parse duration string to milliseconds
 * Supports: ms, s, m, h
 * @param {string} durationStr - Duration string (e.g., "500ms", "1s", "2m")
 * @returns {number|null} - Duration in milliseconds or null if invalid
 */
function parseDuration(durationStr) {
    const durationMatch = durationStr.match(/^(\d+)(ms|s|m|h)?$/);
    if (!durationMatch) {
        return null;
    }
    
    const value = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2] || 'ms';
    
    switch (unit) {
        case 'ms':
            return value;
        case 's':
            return value * 1000;
        case 'm':
            return value * 60 * 1000;
        case 'h':
            return value * 60 * 60 * 1000;
        default:
            return null;
    }
}

/**
 * Parse debug command
 * Format: /debug send <duration> OR /debug send <min>-<max> OR (in command mode) send <duration> OR send <min>-<max>
 * Examples: /debug send 500ms, send 300ms-800ms, send 1s-2s, stop, quit, q
 */
function parseDebugCommand(text) {
    const trimmed = text.trim();
    
    const parts = trimmed.split(/\s+/);
    
    // Remove '/debug' prefix if present
    if (stringIsDebugPrefix(parts[0])) {
        parts.shift();
    }
    
    // Handle stop/quit commands
    if (parts.length === 1) {
        const cmd = parts[0].toLowerCase();
        if (cmd === 'stop' || cmd === 'quit' || cmd === 'q') {
            return { command: 'stop' };
        }
    }
    
    // Handle send command
    if (parts.length < 1) {
        return null;
    }

    const cmd = parts[0].toLowerCase();
    if (cmd === 'send' || cmd === 's') {
        let durationStr = parts.length > 1 ? parts[1] : '1s';
        
        // Check if it's an interval range (e.g., "300ms-800ms" or "1s-2s")
        const rangeMatch = durationStr.match(/^(.+?)-(.+)$/);
        if (rangeMatch) {
            const minStr = rangeMatch[1].trim();
            const maxStr = rangeMatch[2].trim();
            
            const minMs = parseDuration(minStr);
            const maxMs = parseDuration(maxStr);
            
            if (minMs === null || maxMs === null || minMs > maxMs) {
                return null;
            }
            
            return {
                command: 'send',
                minDuration: minMs,
                maxDuration: maxMs
            };
        }
        
        // Check if it's a plus suffix (e.g., "500ms+" means "500ms-1000ms")
        const plusMatch = durationStr.match(/^(.+?)\+$/);
        if (plusMatch) {
            const minStr = plusMatch[1].trim();
            const minMs = parseDuration(minStr);
            
            if (minMs === null) {
                return null;
            }
            
            const maxMs = minMs * 2;
            
            return {
                command: 'send',
                minDuration: minMs,
                maxDuration: maxMs
            };
        }
        
        // Single duration value (backward compatibility)
        const durationMs = parseDuration(durationStr);
        if (durationMs === null) {
            return null;
        }
        
        return {
            command: 'send',
            minDuration: durationMs,
            maxDuration: durationMs
        };
    }

    return null;
}

/**
 * Send a debug message
 */
let debugMessageCounter = 1;
async function sendDebugMessage() {
    if (!currentChatId || !currentUser || !currentUser.info.id) {
        console.warn('Cannot send debug message: no chat selected or user not logged in');
        return;
    }
    
    const sentence = generateDebugSentence();
    
    // Send message directly without modifying input field
    await sendMessage(`${debugMessageCounter}: ${sentence}`);
    debugMessageCounter++;
}

/**
 * Schedule next debug message with random duration within interval
 */
function scheduleNextDebugMessage() {
    if (!isDebugSendModeActive() || debugMinDuration === null || debugMaxDuration === null) {
        return;
    }
    
    // Pick random duration within the interval
    const randomDuration = Math.floor(Math.random() * (debugMaxDuration - debugMinDuration + 1)) + debugMinDuration;
    
    debugTimerId = setTimeout(() => {
        sendDebugMessage();
        scheduleNextDebugMessage(); // Schedule the next one
    }, randomDuration);
}

/**
 * Start debug mode with specified interval range
 * @param {number} minDurationMs - Minimum duration in milliseconds
 * @param {number} maxDurationMs - Maximum duration in milliseconds
 */
function startDebugSendMode(minDurationMs, maxDurationMs) {
    if (isDebugSendModeActive()) {
        console.warn('Debug mode is already active');
        return;
    }
    
    debugMinDuration = minDurationMs;
    debugMaxDuration = maxDurationMs;
    
    setDebugSendMode(true);
    
    if (minDurationMs === maxDurationMs) {
        console.log(`Debug mode started: sending messages every ${minDurationMs}ms`);
    } else {
        console.log(`Debug mode started: sending messages with random interval between ${minDurationMs}ms and ${maxDurationMs}ms`);
    }
    
    // Send first message immediately
    sendDebugMessage();
    
    // Schedule the next message with random duration
    scheduleNextDebugMessage();
}

/**
 * Stop debug mode
 */
function stopDebugMode() {
    const input = getMessageInputElement();
    if (!input || input.dataset.debugCommandMode !== 'true') {
        return;
    }
    
    setDebugSendMode(false);
    setDebugCommandMode(false);
    
    if (debugTimerId) {
        clearTimeout(debugTimerId);
        debugTimerId = null;
    }
    
    if (debugInterval) {
        clearInterval(debugInterval);
        debugInterval = null;
    }
    
    debugMinDuration = null;
    debugMaxDuration = null;
    
    console.log('Debug mode stopped');
}

/**
 * Enter debug command mode
 */
function enterDebugCommandMode() {
    setDebugCommandMode(true);
    console.log('Debug command mode activated. Type commands without /debug prefix. Type "stop", "quit", or "q" to exit.');
}

/**
 * Exit debug command mode
 */
function exitDebugCommandMode() {
    setDebugCommandMode(false);
    console.log('Debug command mode deactivated');
}

/**
 * Handle debug command in message input
 */
function handleDebugCommand(text) {
    const trimmed = text.trim();
    
    // Check if entering debug command mode
    const isDebugPrefix = stringIsDebugPrefix(trimmed);
    if (isDebugPrefix) {
        enterDebugCommandMode();
    }
    
    const command = parseDebugCommand(trimmed);
    
    if (!command) {
        return isDebugPrefix;
    }
    
    if (command.command === 'send') {
        startDebugSendMode(command.minDuration, command.maxDuration);
        return true; // Command handled
    } else if (command.command === 'stop') {
        stopDebugMode();
        return true; // Command handled
    }
    
    return false;
}
