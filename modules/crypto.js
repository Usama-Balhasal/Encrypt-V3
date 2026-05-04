/**
 * Ice Encrypt v3.0 — Crypto Module
 * All encryption/decryption using the native Web Crypto API (AES-GCM + PBKDF2).
 * CryptoJS is retained ONLY for legacy v1/v2 file decryption fallback.
 */

const PBKDF2_ITERATIONS = 250000; // Increased from v2's 100k
const SALT_BYTES = 16;
const IV_BYTES = 12;

/* ==========================================================================
   Session Key Generation
   ========================================================================== */

export function generateSessionKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/* ==========================================================================
   Key Derivation (PBKDF2 → AES-GCM 256-bit)
   ========================================================================== */

async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/* ==========================================================================
   Buffer ↔ Base64 Helpers
   ========================================================================== */

export function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binary);
}

export function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/* ==========================================================================
   Text Encryption / Decryption
   Format: v3:<base64_salt>:<base64_iv>:<base64_ciphertext>
   ========================================================================== */

export async function encryptText(plainText, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(password, salt);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return `Ice:${bufferToBase64(salt)}:${bufferToBase64(iv)}:${bufferToBase64(ciphertext)}`;
}

export async function decryptText(cipherString, password) {
    // Handle legacy v2 format
    if (cipherString.startsWith('v2:')) {
        return _decryptTextV2(cipherString, password);
    }

    const parts = cipherString.split(':');
    if (parts.length !== 4 || parts[0] !== 'Ice') {
        // Check for very old v1 format (raw CryptoJS base64 without version prefix)
        if (_looksLikeV1(cipherString)) {
            throw new Error('This appears to be a legacy v1 encrypted string. It cannot be decrypted by this version. Please use the original Ice Encrypt v1 tool.');
        }
        throw new Error('Invalid encrypted format. Make sure you pasted the entire encrypted string.');
    }

    const salt = base64ToBuffer(parts[1]);
    const iv = base64ToBuffer(parts[2]);
    const ciphertext = base64ToBuffer(parts[3]);
    const key = await deriveKey(password, salt);

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        throw new Error('Decryption failed. Wrong key or corrupted data.');
    }
}

async function _decryptTextV2(cipherString, password) {
    // v2 format: v2:<salt>:<iv>:<ciphertext> — same structure, fewer iterations
    const parts = cipherString.split(':');
    if (parts.length !== 4) throw new Error('Invalid v2 encrypted format.');

    // Re-derive with 100k iterations (v2 used 100k)
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const salt = base64ToBuffer(parts[1]);
    const iv = base64ToBuffer(parts[2]);
    const ciphertext = base64ToBuffer(parts[3]);

    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    try {
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch {
        throw new Error('Decryption failed. Wrong key or corrupted data.');
    }
}

function _looksLikeV1(str) {
    // CryptoJS default output starts with "U2FsdGVkX1" (base64 of "Salted__")
    return str.startsWith('U2FsdGVkX1') || str.includes('ICE_ENCRYPT_SEPARATOR');
}

/* ==========================================================================
   File Encryption / Decryption (Web Crypto API, chunked)
   ========================================================================== */

// Binary format packed into a Blob:
// [4 bytes: metadata JSON length][metadata JSON UTF-8][encrypted binary data]
// Encrypted data = AES-GCM output (includes auth tag)
// Salt (16 bytes) + IV (12 bytes) prepended to the ciphertext in the file blob.

const FILE_MAGIC = 'ICE3'; // 4-byte magic number to identify our format

export async function encryptFile(file, password, onProgress, abortSignal) {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    // Derive once, reuse across chunks (safe — different IV per chunk)
    const key = await deriveKey(password, salt);

    const encryptedChunks = [];

    for (let i = 0; i < totalChunks; i++) {
        if (abortSignal?.aborted) throw new Error('Cancelled');

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkData = await file.slice(start, end).arrayBuffer();

        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            chunkData
        );

        // Prepend IV to each chunk's ciphertext
        const combined = new Uint8Array(IV_BYTES + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), IV_BYTES);
        encryptedChunks.push(combined);

        onProgress((i + 1) / totalChunks);
        await _yield();
    }

    const metadata = {
        magic: FILE_MAGIC,
        version: '3.0',
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type || 'application/octet-stream',
        totalChunks,
        chunkSize: CHUNK_SIZE,
        saltB64: bufferToBase64(salt),
    };

    const metaJson = JSON.stringify(metadata);
    const metaBytes = new TextEncoder().encode(metaJson);
    const metaLenBytes = new Uint8Array(4);
    new DataView(metaLenBytes.buffer).setUint32(0, metaBytes.byteLength, false);

    // Combine: [magic(4)] + [metaLen(4)] + [meta] + [chunk0] + [chunkLen(4)] + [chunk1]...
    // Simpler: use Blob parts array
    const parts = [metaLenBytes, metaBytes];
    for (let i = 0; i < encryptedChunks.length; i++) {
        const lenBytes = new Uint8Array(4);
        new DataView(lenBytes.buffer).setUint32(0, encryptedChunks[i].byteLength, false);
        parts.push(lenBytes, encryptedChunks[i]);
    }

    return new Blob(parts, { type: 'application/octet-stream' });
}

export async function decryptFile(file, password, onProgress, abortSignal) {
    const rawBuffer = await file.arrayBuffer();
    const view = new DataView(rawBuffer);

    // Check if this is a legacy v2 file (text-based JSON + separator format)
    const textContent = await _tryReadAsText(file);
    if (textContent && textContent.includes('---ICE_ENCRYPT_SEPARATOR---')) {
        return _decryptLegacyV2File(textContent, password, onProgress);
    }

    // v3 binary format
    let offset = 0;
    const metaLen = view.getUint32(offset, false);
    offset += 4;

    const metaBytes = new Uint8Array(rawBuffer, offset, metaLen);
    offset += metaLen;

    let metadata;
    try {
        metadata = JSON.parse(new TextDecoder().decode(metaBytes));
    } catch {
        throw new Error('Corrupted file: cannot read metadata.');
    }

    if (metadata.magic !== FILE_MAGIC) {
        throw new Error('Unknown file format. This file was not encrypted with Ice Encrypt v3.');
    }

    const salt = base64ToBuffer(metadata.saltB64);
    const key = await deriveKey(password, salt);

    const decryptedBuffers = [];

    for (let i = 0; i < metadata.totalChunks; i++) {
        if (abortSignal?.aborted) throw new Error('Cancelled');

        const chunkLen = view.getUint32(offset, false);
        offset += 4;

        const chunkData = new Uint8Array(rawBuffer, offset, chunkLen);
        offset += chunkLen;

        const iv = chunkData.slice(0, IV_BYTES);
        const ciphertext = chunkData.slice(IV_BYTES);

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                ciphertext
            );
            decryptedBuffers.push(new Uint8Array(decrypted));
        } catch {
            throw new Error('Decryption failed. Wrong key or corrupted file.');
        }

        onProgress((i + 1) / metadata.totalChunks);
        await _yield();
    }

    return {
        blob: new Blob(decryptedBuffers, { type: metadata.originalType }),
        name: metadata.originalName,
    };
}

/* ==========================================================================
   Legacy v2 File Decryption (CryptoJS-based)
   ========================================================================== */

async function _decryptLegacyV2File(textContent, password, onProgress) {
    if (typeof CryptoJS === 'undefined') {
        throw new Error('Legacy v2 file detected, but CryptoJS is not available for decryption.');
    }

    const parts = textContent.split('\n---ICE_ENCRYPT_SEPARATOR---\n');
    if (parts.length !== 2) throw new Error('Invalid legacy encrypted file format.');

    const metadata = JSON.parse(parts[0]);
    const encChunks = parts[1].split('\n---CHUNK_SEPARATOR---\n');

    const decBuffers = [];
    for (let i = 0; i < encChunks.length; i++) {
        const decrypted = CryptoJS.AES.decrypt(encChunks[i].trim(), password);
        if (!decrypted.sigBytes) throw new Error('Incorrect key or corrupted legacy file.');

        decBuffers.push(_wordArrayToBuffer(decrypted));
        onProgress((i + 1) / encChunks.length);
        await _yield();
    }

    return {
        blob: new Blob(decBuffers, { type: metadata.originalType || 'application/octet-stream' }),
        name: metadata.originalName,
    };
}

function _wordArrayToBuffer(wordArray) {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8.buffer;
}

async function _tryReadAsText(file) {
    // Only try if file is under 10MB (legacy files were text-based)
    if (file.size > 10 * 1024 * 1024) return null;
    try {
        return await file.text();
    } catch {
        return null;
    }
}

/* ==========================================================================
   Password Strength Evaluator
   ========================================================================== */

export function evaluatePasswordStrength(password) {
    if (!password) return { score: 0, label: '—', level: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 14) score++;
    if (password.length >= 20) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', level: 'weak' };
    if (score <= 4) return { score, label: 'Good', level: 'medium' };
    return { score, label: 'Strong', level: 'strong' };
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function _yield() {
    return new Promise(r => setTimeout(r, 0));
}
