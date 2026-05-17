# Ice Encrypt v3.0

A secure, 100% client-side AES-256 encryption and decryption web application.  
Designed for maximum security, privacy, and ease of use.

## 🌟 Features

* **Zero Backend**: Processing happens locally in your browser. No data is ever transmitted to a server.
* **Military-Grade Security**: Uses AES-256-GCM via the native Web Crypto API, with PBKDF2 key derivation (250,000 iterations).
* **File Support**: Encrypt or decrypt any file up to 2 GB (uses chunked processing to prevent memory crashes).
* **Modern UI/UX**: Responsive glassmorphism design with animated background, dark/light modes, drag-and-drop file support, and toast notifications.
* **History Management**: Keeps a local history of your operations (stored in `localStorage` only).
* **Modular Architecture**: Codebase split into ES modules (`crypto.js`, `ui.js`, `history.js`, `main.js`).

## 🚀 How to Use

Because the app uses ES modules (`type="module"`), it must be served over HTTP — opening `index.html` directly as a `file://` URL will not work.

**Quick start with Node.js:**
```bash
npx serve .
```
Then open the URL shown in your terminal (e.g. `http://localhost:3000`).

Or just access the live version at [https://encrypt-v3.netlify.app/.](https://encrypt-v3.netlify.app/)

### Text Mode
1. A unique **Session Key** is generated automatically on each visit. You can also toggle **Use custom encryption key** to set your own passphrase.
2. Type or paste your text into the **Input** box.
3. Click **Encrypt** or press `Ctrl + Enter`.
4. Click **Copy** to copy the secure output.
5. To decrypt, paste an `Ice:…` encrypted string into the Input box and click **Decrypt** (or `Ctrl + Shift + Enter`).

### File Mode
1. Click the **Files** tab.
2. Drag and drop your file(s), or click **browse**.
3. Ensure your encryption key is set as desired.
4. Click **Encrypt Files** — each file is saved with a `.ice` extension.
5. To decrypt, add the `.ice` file(s) and click **Decrypt Files**.

## 🔐 Security Architecture

Ice Encrypt v3.0 addresses major security flaws found in typical client-side crypto apps:

1. **Native Web Crypto API**: All encryption uses the browser's native `SubtleCrypto` API — no third-party crypto libraries for new operations.
2. **AES-GCM**: Uses Galois/Counter Mode (GCM) which provides both confidentiality and data origin authentication (integrity check).
3. **PBKDF2 Derivation**: Keys are derived using PBKDF2 with a unique random salt and **250,000 iterations** of SHA-256.
4. **No Exposed Keys**: A fresh, cryptographically secure 256-bit session key is generated in memory every time you open the app. No keys are persisted or transmitted.
5. **Ciphertext Format**: Encrypted text is prefixed with `Ice:` followed by base64-encoded salt, IV, and ciphertext — making the format self-describing.
6. **No `eval()` or `document.write()`**: Eliminated legacy XSS vectors.

## 👨‍💻 Developer

**Usama Balhasal**
* GitHub: [@Usama-Balhasal](https://github.com/Usama-Balhasal)
* LinkedIn: [Usama Balhasal](https://www.linkedin.com/in/usama-balhasal/)

## 📄 License

This project is open-source. Feel free to use, modify, and distribute as needed.
