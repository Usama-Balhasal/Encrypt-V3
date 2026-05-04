/**
 * Ice Encrypt v3.0 — Main Entry Point
 * Orchestrates all modules, manages state and event listeners.
 */

import { loadTheme, initNav, showToast, showConfirmModal, escapeHtml, debounce, formatFileSize } from './ui.js';
import { generateSessionKey, encryptText, decryptText, encryptFile, decryptFile, evaluatePasswordStrength, bufferToBase64 } from './crypto.js';
import { initHistory, addToHistory, renderHistory, clearAllHistory, getHistoryCount } from './history.js';

/* ==========================================================================
   Global State
   ========================================================================== */

const state = {
    mode: 'text',
    useCustomKey: false,
    sessionKey: generateSessionKey(),
    sessionStats: { encrypted: 0, decrypted: 0 },
    selectedFiles: [],
    processedFiles: [],
    isProcessing: false,
    abortController: null,
};

/* ==========================================================================
   DOM Element Cache
   ========================================================================== */

const $ = id => document.getElementById(id);

const els = {
    // Key
    useCustomKey:     $('useCustomKey'),
    passwordSection:  $('passwordSection'),
    encryptionKey:    $('encryptionKey'),
    passwordToggle:   $('passwordToggle'),
    strengthFill:     $('strengthFill'),
    strengthLabel:    $('strengthLabel'),
    sessionKeyBanner: $('sessionKeyBanner'),
    generateKeyBtn:   $('generateKeyBtn'),
    copySessionKeyBtn:$('copySessionKeyBtn'),
    sessionKeyDisplay:$('sessionKeyDisplay'),
    sessionKeyReveal: $('sessionKeyReveal'),

    // Tabs
    textModeBtn:     $('textModeBtn'),
    fileModeBtn:     $('fileModeBtn'),
    textModeSection: $('textModeSection'),
    fileModeSection: $('fileModeSection'),

    // Text
    textInput:    $('textInput'),
    textOutput:   $('textOutput'),
    charCounter:  $('charCounter'),
    textError:    $('textError'),
    encryptBtn:   $('encryptBtn'),
    decryptBtn:   $('decryptBtn'),
    swapBtn:      $('swapBtn'),
    copyBtn:      $('copyBtn'),
    pasteBtn:     $('pasteBtn'),

    // File
    dropZone:        $('fileDropZone'),
    fileInput:       $('fileInput'),
    browseBtn:       $('browseBtn'),
    fileList:        $('fileList'),
    encryptFilesBtn: $('encryptFilesBtn'),
    decryptFilesBtn: $('decryptFilesBtn'),

    // Progress
    progressSection: $('progressSection'),
    progressBar:     $('progressBar'),
    progressFill:    $('progressFill'),
    progressStatus:  $('progressStatus'),
    progressPercent: $('progressPercent'),
    cancelBtn:       $('cancelBtn'),

    // File Output
    fileOutputSection: $('fileOutputSection'),
    fileOutputList:    $('fileOutputList'),
    downloadAllBtn:    $('downloadAllBtn'),

    // History
    historyToggle:  $('historyToggle'),
    historyBody:    $('historyBody'),
    historyCount:   $('historyCount'),
    historyList:    $('historyList'),
    searchHistory:  $('searchHistory'),
    clearHistoryBtn:$('clearHistoryBtn'),

    // Stats
    statsEncrypted: $('statsEncrypted'),
    statsDecrypted: $('statsDecrypted'),
};

/* ==========================================================================
   Initialization
   ========================================================================== */

function init() {
    loadTheme();
    initNav();
    initHistory(count => {
        if (els.historyCount) els.historyCount.textContent = count;
    });
    attachEventListeners();
    switchMode('text');
    renderHistory();
    if (els.historyCount) els.historyCount.textContent = getHistoryCount();
}

document.addEventListener('DOMContentLoaded', init);

/* ==========================================================================
   Key Management
   ========================================================================== */

function getCurrentKey() {
    if (state.useCustomKey) {
        const key = els.encryptionKey?.value.trim() ?? '';
        if (!key) throw new Error('Please enter a custom encryption key.');
        if (key.length < 6) throw new Error('Key must be at least 6 characters.');
        return key;
    }
    return state.sessionKey;
}

function toggleCustomKey() {
    state.useCustomKey = els.useCustomKey.checked;
    els.passwordSection.hidden = !state.useCustomKey;
    els.sessionKeyBanner.hidden = state.useCustomKey;
    if (!state.useCustomKey) {
        if (els.textError) els.textError.hidden = true;
    }
}

function updateStrengthBar(password) {
    const { level, label } = evaluatePasswordStrength(password);
    if (els.strengthFill) {
        els.strengthFill.className = `strength-fill${level ? ' ' + level : ''}`;
    }
    if (els.strengthLabel) {
        els.strengthLabel.textContent = label;
    }
}

function togglePasswordVisibility() {
    const input = els.encryptionKey;
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    els.passwordToggle?.querySelector('.eye-open')?.style.setProperty('display', isHidden ? 'none' : 'block');
    els.passwordToggle?.querySelector('.eye-closed')?.style.setProperty('display', isHidden ? 'block' : 'none');
}

function generateCustomKey() {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const key = bufferToBase64(array).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
    if (els.encryptionKey) {
        els.encryptionKey.value = key;
        els.encryptionKey.type = 'text'; // Show the generated key
        updateStrengthBar(key);
        els.passwordToggle?.querySelector('.eye-open')?.style.setProperty('display', 'none');
        els.passwordToggle?.querySelector('.eye-closed')?.style.setProperty('display', 'block');
    }
    showToast('Key Generated', 'A strong random key has been created. Save it securely!', 'success');
}

function toggleSessionKeyReveal() {
    const display = els.sessionKeyDisplay;
    const btn = els.sessionKeyReveal;
    if (!display || !btn) return;

    if (display.dataset.revealed === 'true') {
        display.textContent = '••••••••••••••••••••••••••••••••';
        display.dataset.revealed = 'false';
        btn.title = 'Reveal session key';
        btn.querySelector('.eye-open').style.display = 'block';
        btn.querySelector('.eye-closed').style.display = 'none';
    } else {
        display.textContent = state.sessionKey;
        display.dataset.revealed = 'true';
        btn.title = 'Hide session key';
        btn.querySelector('.eye-open').style.display = 'none';
        btn.querySelector('.eye-closed').style.display = 'block';
    }
}

function copySessionKey() {
    navigator.clipboard.writeText(state.sessionKey)
        .then(() => showToast('Copied', 'Session key copied to clipboard.', 'success'))
        .catch(() => showToast('Error', 'Could not copy to clipboard.', 'error'));
}

/* ==========================================================================
   Mode Switching
   ========================================================================== */

function switchMode(mode) {
    state.mode = mode;
    els.textModeBtn?.classList.toggle('active', mode === 'text');
    els.fileModeBtn?.classList.toggle('active', mode === 'file');
    els.textModeBtn?.setAttribute('aria-selected', String(mode === 'text'));
    els.fileModeBtn?.setAttribute('aria-selected', String(mode === 'file'));
    if (els.textModeSection) els.textModeSection.hidden = mode !== 'text';
    if (els.fileModeSection) els.fileModeSection.hidden = mode !== 'file';
    if (els.progressSection) els.progressSection.hidden = true;
    if (mode === 'text') {
        if (els.fileOutputSection) els.fileOutputSection.hidden = true;
    }
}

/* ==========================================================================
   Text Mode
   ========================================================================== */

function updateCharCounter() {
    const count = els.textInput?.value.length ?? 0;
    if (els.charCounter) {
        els.charCounter.textContent = count.toLocaleString() + ' char' + (count !== 1 ? 's' : '');
    }
}

function swapText() {
    const out = els.textOutput?.value;
    if (!out) {
        showToast('Nothing to swap', 'Generate output first.', 'warning');
        return;
    }
    if (els.textInput) els.textInput.value = out;
    if (els.textOutput) els.textOutput.value = '';
    updateCharCounter();
    showToast('Swapped', 'Input and output exchanged.', 'info');
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (els.textInput) {
            els.textInput.value = text;
            updateCharCounter();
            showToast('Pasted', 'Text pasted from clipboard.', 'success');
        }
    } catch {
        showToast('Permission Denied', 'Could not read from clipboard.', 'error');
    }
}

async function handleTextCrypto(operation) {
    clearTextError();
    const text = els.textInput?.value.trim() ?? '';

    if (!text) {
        showTextError('Please enter some text first.');
        return;
    }

    let password;
    try {
        password = getCurrentKey();
    } catch (e) {
        showTextError(e.message);
        return;
    }

    const btn = operation === 'encrypt' ? els.encryptBtn : els.decryptBtn;
    setButtonLoading(btn, true);

    try {
        let result;
        if (operation === 'encrypt') {
            result = await encryptText(text, password);
        } else {
            result = await decryptText(text, password);
        }

        if (els.textOutput) els.textOutput.value = result;
        addToHistory(operation, text, result);
        updateStats(operation);
        showToast('Success', `Text ${operation}ed successfully.`, 'success');

    } catch (e) {
        showTextError(e.message);
        showToast('Error', e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function showTextError(msg) {
    if (els.textError) {
        els.textError.textContent = msg;
        els.textError.hidden = false;
    }
}

function clearTextError() {
    if (els.textError) els.textError.hidden = true;
}

function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg><span>Processing…</span>`;
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        btn.disabled = false;
        delete btn.dataset.originalHtml;
    }
}

function updateStats(operation) {
    if (operation === 'encrypt') {
        state.sessionStats.encrypted++;
        if (els.statsEncrypted) els.statsEncrypted.textContent = state.sessionStats.encrypted;
    } else {
        state.sessionStats.decrypted++;
        if (els.statsDecrypted) els.statsDecrypted.textContent = state.sessionStats.decrypted;
    }
}

/* ==========================================================================
   File Mode
   ========================================================================== */

function getFileIcon(filename, type) {
    if (filename.endsWith('.ice')) return '🔐';
    if (type?.startsWith('image/')) return '🖼️';
    if (type?.startsWith('video/')) return '🎬';
    if (type?.startsWith('audio/')) return '🎵';
    if (type?.startsWith('text/') || type?.includes('json')) return '📄';
    if (type?.includes('pdf')) return '📕';
    if (type?.includes('zip') || type?.includes('compressed') || type?.includes('archive')) return '📦';
    if (type?.includes('word') || type?.includes('document')) return '📝';
    return '📁';
}

function handleFilesAdded(filesArray) {
    const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
    let added = 0;

    for (const file of filesArray) {
        if (file.size > MAX_SIZE) {
            showToast('File Too Large', `"${file.name}" exceeds the 2 GB limit.`, 'error');
            continue;
        }
        if (!state.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            state.selectedFiles.push(file);
            added++;
        }
    }

    if (added > 0) renderFileList();
}

function removeFile(index) {
    state.selectedFiles.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    const el = els.fileList;
    if (!el) return;

    if (state.selectedFiles.length === 0) {
        el.innerHTML = '';
        return;
    }

    el.innerHTML = state.selectedFiles.map((file, i) => `
        <div class="file-item">
            <div class="file-info">
                <span class="file-icon">${getFileIcon(file.name, file.type)}</span>
                <div class="file-details">
                    <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <div class="file-meta">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="icon-btn danger remove-file-btn" data-index="${i}" title="Remove file" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    `).join('');

    el.querySelectorAll('.remove-file-btn').forEach(btn => {
        btn.addEventListener('click', () => removeFile(Number(btn.dataset.index)));
    });
}

function setProgress(status, percent) {
    if (els.progressStatus) els.progressStatus.textContent = status;
    const pct = Math.round(percent * 100);
    if (els.progressPercent) els.progressPercent.textContent = `${pct}%`;
    if (els.progressFill) els.progressFill.style.width = `${pct}%`;
    if (els.progressBar) els.progressBar.setAttribute('aria-valuenow', pct);
}

async function handleFileCrypto(operation) {
    if (state.selectedFiles.length === 0) {
        showToast('No Files', 'Please add files to process.', 'warning');
        return;
    }

    let password;
    try {
        password = getCurrentKey();
    } catch (e) {
        showToast('Key Error', e.message, 'error');
        return;
    }

    if (operation === 'decrypt') {
        const hasNonIce = state.selectedFiles.some(f => !f.name.endsWith('.ice'));
        if (hasNonIce) {
            showToast('Invalid Files', 'Only .ice files can be decrypted.', 'error');
            return;
        }
    }

    state.isProcessing = true;
    state.abortController = new AbortController();
    state.processedFiles = [];

    if (els.progressSection) els.progressSection.hidden = false;
    if (els.fileOutputSection) els.fileOutputSection.hidden = true;
    if (els.encryptFilesBtn) els.encryptFilesBtn.disabled = true;
    if (els.decryptFilesBtn) els.decryptFilesBtn.disabled = true;

    try {
        const total = state.selectedFiles.length;

        for (let i = 0; i < total; i++) {
            if (state.abortController.signal.aborted) break;
            const file = state.selectedFiles[i];
            const verb = operation === 'encrypt' ? 'Encrypting' : 'Decrypting';
            setProgress(`${verb} ${file.name}…`, i / total);

            try {
                if (operation === 'encrypt') {
                    const blob = await encryptFile(file, password,
                        p => setProgress(`Encrypting ${file.name}…`, (i + p) / total),
                        state.abortController.signal
                    );
                    state.processedFiles.push({ blob, name: file.name + '.ice', operation });
                } else {
                    const { blob, name } = await decryptFile(file, password,
                        p => setProgress(`Decrypting ${file.name}…`, (i + p) / total),
                        state.abortController.signal
                    );
                    state.processedFiles.push({ blob, name, operation });
                }
                addToHistory(operation, `File: ${file.name}`, `Result: ${state.processedFiles.at(-1).name}`);
                updateStats(operation);
            } catch (e) {
                if (e.message === 'Cancelled') break;
                showToast(`Error: ${file.name}`, e.message, 'error');
            }
        }

        if (!state.abortController.signal.aborted && state.processedFiles.length > 0) {
            setProgress('Complete!', 1);
            renderFileOutputs();
            state.selectedFiles = [];
            renderFileList();
            if (els.fileInput) els.fileInput.value = '';
            showToast('Done', `Processed ${state.processedFiles.length} file(s) successfully.`, 'success');
        }

    } catch (e) {
        if (e.message !== 'Cancelled') showToast('Processing Error', e.message, 'error');
    } finally {
        state.isProcessing = false;
        state.abortController = null;
        if (els.encryptFilesBtn) els.encryptFilesBtn.disabled = false;
        if (els.decryptFilesBtn) els.decryptFilesBtn.disabled = false;
        setTimeout(() => {
            if (!state.isProcessing && els.progressSection) els.progressSection.hidden = true;
        }, 2000);
    }
}

function renderFileOutputs() {
    const el = els.fileOutputList;
    if (!el) return;

    if (state.processedFiles.length === 0) {
        if (els.fileOutputSection) els.fileOutputSection.hidden = true;
        return;
    }

    if (els.fileOutputSection) els.fileOutputSection.hidden = false;

    el.innerHTML = state.processedFiles.map((f, i) => `
        <div class="file-item processed">
            <div class="file-info">
                <span class="file-icon">${f.operation === 'encrypt' ? '🔐' : '🔓'}</span>
                <div class="file-details">
                    <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                    <div class="file-meta">${f.operation === 'encrypt' ? 'Encrypted' : 'Decrypted'} &bull; ${formatFileSize(f.blob.size)}</div>
                </div>
            </div>
            <button class="btn btn-ghost btn-sm download-file-btn" data-index="${i}" title="Download" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
            </button>
        </div>
    `).join('');

    el.querySelectorAll('.download-file-btn').forEach(btn => {
        btn.addEventListener('click', () => downloadFile(Number(btn.dataset.index)));
    });
}

function downloadFile(index) {
    const f = state.processedFiles[index];
    if (!f) return;
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function downloadAllFiles() {
    state.processedFiles.forEach((_, i) => setTimeout(() => downloadFile(i), i * 300));
}

/* ==========================================================================
   History Panel
   ========================================================================== */

function toggleHistory() {
    const isOpen = els.historyToggle?.getAttribute('aria-expanded') === 'true';
    els.historyToggle?.setAttribute('aria-expanded', String(!isOpen));
    if (els.historyBody) els.historyBody.hidden = isOpen;
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

function attachEventListeners() {
    // Tabs
    els.textModeBtn?.addEventListener('click', () => switchMode('text'));
    els.fileModeBtn?.addEventListener('click', () => switchMode('file'));

    // Key
    els.useCustomKey?.addEventListener('change', toggleCustomKey);
    els.passwordToggle?.addEventListener('click', togglePasswordVisibility);
    els.encryptionKey?.addEventListener('input', e => updateStrengthBar(e.target.value));
    els.generateKeyBtn?.addEventListener('click', generateCustomKey);
    els.copySessionKeyBtn?.addEventListener('click', copySessionKey);
    els.sessionKeyReveal?.addEventListener('click', toggleSessionKeyReveal);

    // Text mode
    els.textInput?.addEventListener('input', updateCharCounter);
    els.encryptBtn?.addEventListener('click', () => handleTextCrypto('encrypt'));
    els.decryptBtn?.addEventListener('click', () => handleTextCrypto('decrypt'));
    els.swapBtn?.addEventListener('click', swapText);
    els.pasteBtn?.addEventListener('click', pasteFromClipboard);

    els.copyBtn?.addEventListener('click', async () => {
        const text = els.textOutput?.value;
        if (!text) { showToast('Nothing to Copy', 'No output text yet.', 'warning'); return; }
        try {
            await navigator.clipboard.writeText(text);
            const orig = els.copyBtn.innerHTML;
            els.copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            els.copyBtn.style.color = 'var(--accent-green)';
            setTimeout(() => { els.copyBtn.innerHTML = orig; els.copyBtn.style.color = ''; }, 2000);
        } catch { showToast('Copy Failed', 'Could not access clipboard.', 'error'); }
    });

    // Keyboard shortcuts
    els.textInput?.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            e.shiftKey ? handleTextCrypto('decrypt') : handleTextCrypto('encrypt');
        }
    });

    // File mode — browseBtn triggers file input; drop-zone click triggers input only when
    // the click did NOT originate from the browseBtn (which handles its own click).
    els.browseBtn?.addEventListener('click', e => {
        e.stopPropagation(); // prevent drop-zone click from also firing
        els.fileInput?.click();
    });
    els.dropZone?.addEventListener('click', e => {
        // Only trigger if click came from the zone itself (not the button inside it)
        if (!els.browseBtn?.contains(e.target)) {
            els.fileInput?.click();
        }
    });

    // Keyboard accessibility on drop zone
    els.dropZone?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput?.click(); }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
        els.dropZone?.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
    );
    els.dropZone?.addEventListener('dragenter', () => els.dropZone?.classList.add('drag-over'));
    els.dropZone?.addEventListener('dragover',  () => els.dropZone?.classList.add('drag-over'));
    els.dropZone?.addEventListener('dragleave', e => {
        if (!els.dropZone?.contains(e.relatedTarget)) els.dropZone?.classList.remove('drag-over');
    });
    els.dropZone?.addEventListener('drop', e => {
        els.dropZone?.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFilesAdded(Array.from(e.dataTransfer.files));
    });

    els.fileInput?.addEventListener('change', e => {
        if (e.target.files.length) handleFilesAdded(Array.from(e.target.files));
    });

    els.encryptFilesBtn?.addEventListener('click', () => handleFileCrypto('encrypt'));
    els.decryptFilesBtn?.addEventListener('click', () => handleFileCrypto('decrypt'));
    els.cancelBtn?.addEventListener('click', () => state.abortController?.abort());
    els.downloadAllBtn?.addEventListener('click', downloadAllFiles);

    // History
    els.historyToggle?.addEventListener('click', toggleHistory);
    els.clearHistoryBtn?.addEventListener('click', clearAllHistory);
    els.searchHistory?.addEventListener('input', debounce(e => renderHistory(e.target.value), 300));
}
