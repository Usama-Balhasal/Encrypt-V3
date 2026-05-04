/**
 * Ice Encrypt v2.0 - Main Script
 * Re-architected into modular functions and modernized syntax.
 */

// Global state
const state = {
    mode: 'text', // 'text' or 'file'
    useCustomKey: false,
    sessionKey: generateSessionKey(),
    history: [],
    selectedFiles: [],
    processedFiles: [],
    isProcessing: false,
    abortController: null
};

// DOM Elements
const els = {
    // Nav
    themeBtn: document.getElementById('themeToggleBtn'),
    hamburger: document.getElementById('navHamburger'),
    navLinks: document.getElementById('navLinks'),
    
    // Key Config
    useCustomKey: document.getElementById('useCustomKey'),
    passwordSection: document.getElementById('passwordSection'),
    encryptionKey: document.getElementById('encryptionKey'),
    passwordToggle: document.getElementById('passwordToggle'),
    strengthFill: document.getElementById('strengthFill'),
    strengthLabel: document.getElementById('strengthLabel'),
    sessionKeyBanner: document.getElementById('sessionKeyBanner'),
    
    // Modes
    textModeBtn: document.getElementById('textModeBtn'),
    fileModeBtn: document.getElementById('fileModeBtn'),
    textModeSection: document.getElementById('textModeSection'),
    fileModeSection: document.getElementById('fileModeSection'),
    
    // Text Mode
    textInput: document.getElementById('textInput'),
    textOutput: document.getElementById('textOutput'),
    charCounter: document.getElementById('charCounter'),
    textError: document.getElementById('textError'),
    encryptBtn: document.getElementById('encryptBtn'),
    decryptBtn: document.getElementById('decryptBtn'),
    swapBtn: document.getElementById('swapBtn'),
    copyBtn: document.getElementById('copyBtn'),
    
    // File Mode
    dropZone: document.getElementById('fileDropZone'),
    fileInput: document.getElementById('fileInput'),
    browseBtn: document.getElementById('browseBtn'),
    fileList: document.getElementById('fileList'),
    encryptFilesBtn: document.getElementById('encryptFilesBtn'),
    decryptFilesBtn: document.getElementById('decryptFilesBtn'),
    
    // Progress
    progressSection: document.getElementById('progressSection'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    progressStatus: document.getElementById('progressStatus'),
    progressPercent: document.getElementById('progressPercent'),
    cancelBtn: document.getElementById('cancelBtn'),
    
    // File Output
    fileOutputSection: document.getElementById('fileOutputSection'),
    fileOutputList: document.getElementById('fileOutputList'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    
    // History
    historyToggle: document.getElementById('historyToggle'),
    historyBody: document.getElementById('historyBody'),
    historyCount: document.getElementById('historyCount'),
    historyList: document.getElementById('historyList'),
    searchHistory: document.getElementById('searchHistory'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    
    // Toasts
    toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Initialization
   ========================================================================== */

function init() {
    loadTheme();
    loadHistory();
    attachEventListeners();
    updateUIForMode(state.mode);
}

document.addEventListener('DOMContentLoaded', init);

/* ==========================================================================
   Toast Notification System
   ========================================================================== */

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        ${iconSvg}
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Close notification">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    els.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    
    const removeToast = () => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    };
    
    closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 5000);
}

/* ==========================================================================
   Key Management & Security
   ========================================================================== */

function generateSessionKey() {
    // Generate a proper random 256-bit session key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getCurrentKey() {
    if (state.useCustomKey) {
        const key = els.encryptionKey.value.trim();
        if (!key) throw new Error("Please enter a custom encryption key.");
        if (key.length < 6) throw new Error("Custom key must be at least 6 characters.");
        return key;
    }
    return state.sessionKey;
}

function evaluatePasswordStrength(password) {
    if (!password) {
        els.strengthFill.className = 'strength-fill';
        els.strengthLabel.textContent = '—';
        return;
    }
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    els.strengthFill.className = 'strength-fill';
    
    if (score < 2) {
        els.strengthFill.classList.add('weak');
        els.strengthLabel.textContent = 'Weak';
    } else if (score < 4) {
        els.strengthFill.classList.add('medium');
        els.strengthLabel.textContent = 'Good';
    } else {
        els.strengthFill.classList.add('strong');
        els.strengthLabel.textContent = 'Strong';
    }
}

/* ==========================================================================
   UI Interactions & Navigation
   ========================================================================== */

function loadTheme() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

function toggleTheme() {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('darkMode', isDark);
}

function updateUIForMode(mode) {
    state.mode = mode;
    
    // Tabs
    els.textModeBtn.classList.toggle('active', mode === 'text');
    els.fileModeBtn.classList.toggle('active', mode === 'file');
    els.textModeBtn.setAttribute('aria-selected', mode === 'text');
    els.fileModeBtn.setAttribute('aria-selected', mode === 'file');
    
    // Panels
    els.textModeSection.hidden = mode !== 'text';
    els.fileModeSection.hidden = mode !== 'file';
    
    // Hide progress/outputs
    els.progressSection.hidden = true;
    if (mode === 'text') {
        els.fileOutputSection.hidden = true;
    } else {
        els.textOutput.value = '';
    }
}

function toggleHistory() {
    const isExpanded = els.historyToggle.getAttribute('aria-expanded') === 'true';
    els.historyToggle.setAttribute('aria-expanded', !isExpanded);
    els.historyBody.hidden = isExpanded;
}

function toggleCustomKey() {
    state.useCustomKey = els.useCustomKey.checked;
    els.passwordSection.hidden = !state.useCustomKey;
    els.sessionKeyBanner.hidden = state.useCustomKey;
    
    if (!state.useCustomKey) {
        els.textError.hidden = true;
    }
}

function updateCharCounter() {
    const count = els.textInput.value.length;
    els.charCounter.textContent = \`\${count} char\${count !== 1 ? 's' : ''}\`;
}

function swapText() {
    const currentInput = els.textInput.value;
    const currentOutput = els.textOutput.value;
    
    if (!currentOutput) {
        showToast("Cannot Swap", "No output generated yet.", "error");
        return;
    }
    
    els.textInput.value = currentOutput;
    els.textOutput.value = '';
    updateCharCounter();
    showToast("Swapped", "Input and output have been swapped.", "info");
}

/* ==========================================================================
   Text Encryption / Decryption (Web Crypto API)
   ========================================================================== */

// Helper to derive a proper key using PBKDF2
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// ArrayBuffer to Base64
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Base64 to ArrayBuffer
function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function handleTextCrypto(operation) {
    els.textError.hidden = true;
    const text = els.textInput.value.trim();
    
    if (!text) {
        els.textError.textContent = "Please enter some text.";
        els.textError.hidden = false;
        return;
    }
    
    let password;
    try {
        password = getCurrentKey();
    } catch (e) {
        els.textError.textContent = e.message;
        els.textError.hidden = false;
        return;
    }
    
    const btn = operation === 'encrypt' ? els.encryptBtn : els.decryptBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> Processing…`;
    btn.disabled = true;

    try {
        let result = '';
        if (operation === 'encrypt') {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await deriveKey(password, salt);
            
            const encryptedContent = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                data
            );
            
            // Format: Base64(salt) : Base64(iv) : Base64(encryptedContent)
            result = `v2:${bufferToBase64(salt)}:${bufferToBase64(iv)}:${bufferToBase64(encryptedContent)}`;
            
        } else {
            // Decrypt
            if (text.startsWith('U2FzZ') || text.includes('ICE_ENCRYPT_SEPARATOR')) {
                throw new Error("This looks like v1 legacy encryption or a file. Please use the v1 version of the app to decrypt legacy data.");
            }
            
            const parts = text.split(':');
            if (parts.length !== 4 || parts[0] !== 'v2') {
                throw new Error("Invalid encrypted format. Make sure you pasted the entire string.");
            }
            
            const salt = base64ToBuffer(parts[1]);
            const iv = base64ToBuffer(parts[2]);
            const encryptedContent = base64ToBuffer(parts[3]);
            
            const key = await deriveKey(password, salt);
            
            try {
                const decryptedContent = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: iv },
                    key,
                    encryptedContent
                );
                const decoder = new TextDecoder();
                result = decoder.decode(decryptedContent);
            } catch (err) {
                throw new Error("Decryption failed. Incorrect key or corrupted data.");
            }
        }
        
        els.textOutput.value = result;
        addToHistory(operation, text, result);
        showToast("Success", \`Text successfully \${operation}ed.\`, "success");
        
    } catch (e) {
        els.textError.textContent = e.message;
        els.textError.hidden = false;
        showToast("Error", e.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/* ==========================================================================
   File Management
   ========================================================================== */

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(filename, type) {
    if (filename.endsWith('.ice')) return '🔐';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('text/') || type.includes('json')) return '📄';
    if (type.includes('pdf')) return '📕';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📁';
}

function handleFilesAdded(filesArray) {
    const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    let added = 0;
    
    filesArray.forEach(file => {
        if (file.size > MAX_SIZE) {
            showToast("File too large", \`"\${file.name}" exceeds the 2GB limit.\`, "error");
            return;
        }
        // Don't add duplicates
        if (!state.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            state.selectedFiles.push(file);
            added++;
        }
    });
    
    if (added > 0) {
        renderFileList();
    }
}

function removeFile(index) {
    state.selectedFiles.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    if (state.selectedFiles.length === 0) {
        els.fileList.innerHTML = '';
        return;
    }
    
    els.fileList.innerHTML = state.selectedFiles.map((file, i) => \`
        <div class="file-item">
            <div class="file-info">
                <span class="file-icon">\${getFileIcon(file.name, file.type)}</span>
                <div class="file-details">
                    <div class="file-name" title="\${escapeHtml(file.name)}">\${escapeHtml(file.name)}</div>
                    <div class="file-meta">\${formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-ghost btn-sm" onclick="removeFile(\${i})" title="Remove file">✕</button>
            </div>
        </div>
    \`).join('');
}

/* ==========================================================================
   File Processing (CryptoJS for legacy compatibility of files)
   ========================================================================== */

function setProgress(status, percent) {
    els.progressStatus.textContent = status;
    els.progressPercent.textContent = Math.round(percent * 100) + '%';
    els.progressFill.style.width = \`\${percent * 100}%\`;
}

// Convert CryptoJS WordArray to native ArrayBuffer
function wordArrayToBuffer(wordArray) {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8.buffer;
}

// Convert native ArrayBuffer to CryptoJS WordArray
function bufferToWordArray(buffer) {
    const u8 = new Uint8Array(buffer);
    const words = [];
    for (let i = 0; i < u8.length; i++) {
        words[i >>> 2] |= u8[i] << (24 - (i % 4) * 8);
    }
    return CryptoJS.lib.WordArray.create(words, u8.length);
}

async function processFileChunked(file, password, operation, onProgress) {
    const CHUNK_SIZE = window.ICE_CONFIG?.chunkSize || 1024 * 1024;
    
    if (operation === 'encrypt') {
        const chunks = Math.ceil(file.size / CHUNK_SIZE);
        const encryptedChunks = [];
        
        for (let i = 0; i < chunks; i++) {
            if (state.abortController?.signal.aborted) throw new Error("Cancelled");
            
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = await file.slice(start, end).arrayBuffer();
            
            const wordArray = bufferToWordArray(chunk);
            // using CryptoJS for file chunking compatibility
            const encrypted = CryptoJS.AES.encrypt(wordArray, password).toString();
            encryptedChunks.push(encrypted);
            
            onProgress((i + 1) / chunks);
            await new Promise(r => setTimeout(r, 0)); // yield
        }
        
        const metadata = {
            originalName: file.name,
            originalSize: file.size,
            originalType: file.type,
            version: '2.0',
            chunked: true,
            totalChunks: chunks
        };
        
        const output = JSON.stringify(metadata) + '\\n---ICE_ENCRYPT_SEPARATOR---\\n' + encryptedChunks.join('\\n---CHUNK_SEPARATOR---\\n');
        return new Blob([output], { type: 'application/octet-stream' });
        
    } else {
        // Decrypt
        const text = await file.text();
        const parts = text.split('\\n---ICE_ENCRYPT_SEPARATOR---\\n');
        if (parts.length !== 2) throw new Error("Invalid encrypted file format.");
        
        const metadata = JSON.parse(parts[0]);
        if (!metadata.chunked) {
            // handle small file fallback
            const decrypted = CryptoJS.AES.decrypt(parts[1], password);
            if (!decrypted.sigBytes) throw new Error("Incorrect key or corrupted file.");
            return { blob: new Blob([wordArrayToBuffer(decrypted)], { type: metadata.originalType }), name: metadata.originalName };
        }
        
        const encChunks = parts[1].split('\\n---CHUNK_SEPARATOR---\\n');
        if (encChunks.length !== metadata.totalChunks) throw new Error("Corrupted chunked file.");
        
        const decBuffers = [];
        for (let i = 0; i < encChunks.length; i++) {
            if (state.abortController?.signal.aborted) throw new Error("Cancelled");
            
            const decrypted = CryptoJS.AES.decrypt(encChunks[i], password);
            if (!decrypted.sigBytes) throw new Error("Incorrect key or corrupted file.");
            
            decBuffers.push(wordArrayToBuffer(decrypted));
            onProgress((i + 1) / encChunks.length);
            await new Promise(r => setTimeout(r, 0));
        }
        
        return {
            blob: new Blob(decBuffers, { type: metadata.originalType }),
            name: metadata.originalName
        };
    }
}

async function handleFileCrypto(operation) {
    if (state.selectedFiles.length === 0) {
        showToast("Warning", "Please select files to process.", "warning");
        return;
    }
    
    let password;
    try {
        password = getCurrentKey();
    } catch (e) {
        showToast("Configuration Error", e.message, "error");
        return;
    }
    
    if (operation === 'decrypt') {
        const hasNonIce = state.selectedFiles.some(f => !f.name.endsWith('.ice'));
        if (hasNonIce) {
            showToast("Warning", "Only .ice files can be decrypted.", "error");
            return;
        }
    }
    
    state.isProcessing = true;
    state.abortController = new AbortController();
    state.processedFiles = [];
    
    els.progressSection.hidden = false;
    els.encryptFilesBtn.disabled = true;
    els.decryptFilesBtn.disabled = true;
    
    try {
        const totalFiles = state.selectedFiles.length;
        
        for (let i = 0; i < totalFiles; i++) {
            if (state.abortController.signal.aborted) break;
            
            const file = state.selectedFiles[i];
            setProgress(\`\${operation === 'encrypt' ? 'Encrypting' : 'Decrypting'} \${file.name}...\`, i / totalFiles);
            
            let resultBlob;
            let resultName;
            
            if (operation === 'encrypt') {
                resultBlob = await processFileChunked(file, password, 'encrypt', (p) => {
                    setProgress(\`Encrypting \${file.name}...\`, (i + p) / totalFiles);
                });
                resultName = file.name + '.ice';
            } else {
                const dec = await processFileChunked(file, password, 'decrypt', (p) => {
                    setProgress(\`Decrypting \${file.name}...\`, (i + p) / totalFiles);
                });
                resultBlob = dec.blob;
                resultName = dec.name;
            }
            
            state.processedFiles.push({
                blob: resultBlob,
                name: resultName,
                operation: operation
            });
            
            addToHistory(operation, \`File: \${file.name}\`, \`Result: \${resultName}\`);
        }
        
        if (!state.abortController.signal.aborted) {
            setProgress("Complete!", 1);
            renderFileOutputs();
            showToast("Success", \`Processed \${state.processedFiles.length} files successfully.\`, "success");
            // Clear input queue
            state.selectedFiles = [];
            renderFileList();
            els.fileInput.value = '';
        }
        
    } catch (e) {
        if (e.message === "Cancelled") {
            showToast("Cancelled", "File processing stopped.", "info");
        } else {
            showToast("Processing Error", e.message, "error");
        }
    } finally {
        state.isProcessing = false;
        state.abortController = null;
        els.encryptFilesBtn.disabled = false;
        els.decryptFilesBtn.disabled = false;
        setTimeout(() => {
            if (!state.isProcessing) els.progressSection.hidden = true;
        }, 2000);
    }
}

function renderFileOutputs() {
    if (state.processedFiles.length === 0) {
        els.fileOutputSection.hidden = true;
        return;
    }
    
    els.fileOutputSection.hidden = false;
    els.fileOutputList.innerHTML = state.processedFiles.map((f, i) => \`
        <div class="processed-file-item">
            <div class="file-info">
                <span class="file-icon">\${f.operation === 'encrypt' ? '🔐' : '🔓'}</span>
                <div class="file-details">
                    <div class="file-name" title="\${escapeHtml(f.name)}">\${escapeHtml(f.name)}</div>
                    <div class="file-meta">\${f.operation === 'encrypt' ? 'Encrypted' : 'Decrypted'} • \${formatFileSize(f.blob.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-ghost btn-sm" onclick="downloadFile(\${i})" title="Download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        </div>
    \`).join('');
}

function downloadFile(index) {
    const f = state.processedFiles[index];
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadAllProcessed() {
    state.processedFiles.forEach((f, i) => {
        setTimeout(() => downloadFile(i), i * 200); // Stagger downloads slightly
    });
}

/* ==========================================================================
   History Management
   ========================================================================== */

function loadHistory() {
    try {
        const saved = localStorage.getItem('iceEncryptHistoryV2');
        if (saved) {
            state.history = JSON.parse(saved);
            renderHistory();
            els.historyCount.textContent = state.history.length;
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
}

function saveHistory() {
    try {
        localStorage.setItem('iceEncryptHistoryV2', JSON.stringify(state.history));
        els.historyCount.textContent = state.history.length;
    } catch (e) {
        console.error("Failed to save history", e);
    }
}

function addToHistory(type, input, output) {
    const item = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type,
        input,
        output,
        timestamp: new Date().toLocaleString()
    };
    
    state.history.unshift(item);
    
    // Prune
    const max = window.ICE_CONFIG?.maxHistoryItems || 50;
    if (state.history.length > max) {
        state.history = state.history.slice(0, max);
    }
    
    saveHistory();
    renderHistory(els.searchHistory.value);
}

function deleteHistoryItem(id) {
    state.history = state.history.filter(h => h.id !== id);
    saveHistory();
    renderHistory(els.searchHistory.value);
}

function clearAllHistory() {
    if (state.history.length === 0) return;
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
        state.history = [];
        saveHistory();
        renderHistory();
        showToast("Cleared", "History has been cleared.", "info");
    }
}

function renderHistory(filterText = '') {
    if (state.history.length === 0) {
        els.historyList.innerHTML = '<p class="empty-state">No history yet. Start encrypting or decrypting!</p>';
        return;
    }

    const lowerFilter = filterText.toLowerCase();
    const filtered = state.history.filter(h => 
        h.input.toLowerCase().includes(lowerFilter) || 
        h.output.toLowerCase().includes(lowerFilter) ||
        h.type.toLowerCase().includes(lowerFilter)
    );

    if (filtered.length === 0) {
        els.historyList.innerHTML = '<p class="empty-state">No matches found.</p>';
        return;
    }

    els.historyList.innerHTML = filtered.map(h => \`
        <div class="history-item">
            <div class="hist-header">
                <div class="hist-type \${h.type}">
                    \${h.type === 'encrypt' ? '🔐 Encrypted' : '🔓 Decrypted'}
                </div>
                <div class="hist-meta">
                    <span class="hist-time">\${h.timestamp}</span>
                    <button class="hist-delete" onclick="deleteHistoryItem('\${h.id}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="hist-content">
                <div class="hist-field">
                    <span class="hist-label">Input</span>
                    <div class="hist-val">\${escapeHtml(truncate(h.input, 150))}</div>
                </div>
                <div class="hist-field">
                    <span class="hist-label">Output</span>
                    <div class="hist-val">\${escapeHtml(truncate(h.output, 150))}</div>
                </div>
            </div>
        </div>
    \`).join('');
}

/* ==========================================================================
   Utilities
   ========================================================================== */

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function truncate(str, max) {
    return str.length > max ? str.substring(0, max) + '...' : str;
}

// Debounce helper for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

function attachEventListeners() {
    // Nav
    els.themeBtn?.addEventListener('click', toggleTheme);
    els.hamburger?.addEventListener('click', () => {
        const open = els.hamburger.getAttribute('aria-expanded') === 'true';
        els.hamburger.setAttribute('aria-expanded', !open);
        els.navLinks.classList.toggle('open', !open);
    });
    
    // Modes
    els.textModeBtn?.addEventListener('click', () => updateUIForMode('text'));
    els.fileModeBtn?.addEventListener('click', () => updateUIForMode('file'));
    
    // Key Config
    els.useCustomKey?.addEventListener('change', toggleCustomKey);
    els.passwordToggle?.addEventListener('click', () => {
        const isPw = els.encryptionKey.type === 'password';
        els.encryptionKey.type = isPw ? 'text' : 'password';
        els.passwordToggle.querySelector('.eye-open').style.display = isPw ? 'none' : 'block';
        els.passwordToggle.querySelector('.eye-closed').style.display = isPw ? 'block' : 'none';
    });
    els.encryptionKey?.addEventListener('input', (e) => evaluatePasswordStrength(e.target.value));
    
    // Text Mode
    els.textInput?.addEventListener('input', updateCharCounter);
    els.encryptBtn?.addEventListener('click', () => handleTextCrypto('encrypt'));
    els.decryptBtn?.addEventListener('click', () => handleTextCrypto('decrypt'));
    els.swapBtn?.addEventListener('click', swapText);
    els.copyBtn?.addEventListener('click', async () => {
        const text = els.textOutput.value;
        if (!text) {
            showToast("Nothing to copy", "No output text available.", "warning");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const origHTML = els.copyBtn.innerHTML;
            els.copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            els.copyBtn.style.color = 'var(--accent-green)';
            
            setTimeout(() => {
                els.copyBtn.innerHTML = origHTML;
                els.copyBtn.style.color = '';
            }, 2000);
        } catch (err) {
            showToast("Copy Failed", "Could not write to clipboard.", "error");
        }
    });
    
    // Keyboard shortcuts (Ctrl+Enter to encrypt, Shift+Ctrl+Enter to decrypt)
    els.textInput?.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) handleTextCrypto('decrypt');
            else handleTextCrypto('encrypt');
        }
    });
    
    // File Mode
    els.browseBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.fileInput.click();
    });
    
    els.dropZone?.addEventListener('click', (e) => {
        if (e.target !== els.browseBtn) els.fileInput.click();
    });
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        els.dropZone?.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    els.dropZone?.addEventListener('dragover', () => els.dropZone.classList.add('drag-over'));
    els.dropZone?.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
    els.dropZone?.addEventListener('drop', (e) => {
        els.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFilesAdded(Array.from(e.dataTransfer.files));
    });
    
    els.fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length) handleFilesAdded(Array.from(e.target.files));
    });
    
    els.encryptFilesBtn?.addEventListener('click', () => handleFileCrypto('encrypt'));
    els.decryptFilesBtn?.addEventListener('click', () => handleFileCrypto('decrypt'));
    els.cancelBtn?.addEventListener('click', () => {
        if (state.abortController) state.abortController.abort();
    });
    els.downloadAllBtn?.addEventListener('click', downloadAllProcessed);
    
    // History
    els.historyToggle?.addEventListener('click', toggleHistory);
    els.clearHistoryBtn?.addEventListener('click', clearAllHistory);
    els.searchHistory?.addEventListener('input', debounce((e) => renderHistory(e.target.value), 300));
}