// =========================================================================
// 🚀🚀🚀 版本号：crypto3.1（“幽灵凭证”版 - ES6 模块适配） 🚀🚀🚀
// ⚙️ 第一部分：[配置与环境区] (自由调整安全性与运行速度)
// =========================================================================
const CryptoConfig = {
    iterations: 600000,
    hashAlgorithm: "SHA-512",
    aesKeyLength: 256,
    saltLength: 32,
    ivLength: 12
};

const getCryptoInstance = () => {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) return window.crypto;
    throw new Error("🚨 当前运行环境不支持 Web Crypto API");
};

// =========================================================================
// 🔐 第二部分：[底层核心引擎] (v3.0 幽灵协议版 + 切片防爆栈)
// ✨ 修改点：在 const CryptoCore 前面加了 export
// =========================================================================
export const CryptoCore = {
    
    async createCredential(passwordStr) {
        const cryptoInstance = getCryptoInstance();
        const encoder = new TextEncoder();
        const rawPwdBytes = encoder.encode(passwordStr);
        const preHashedBuffer = await cryptoInstance.subtle.digest(CryptoConfig.hashAlgorithm, rawPwdBytes);
        const credential = await cryptoInstance.subtle.importKey(
            "raw", preHashedBuffer, { name: "PBKDF2" }, false, ["deriveKey"]
        );
        cryptoInstance.getRandomValues(rawPwdBytes); 
        return credential; 
    },

    async _deriveAesKeyFromCredential(credential, salt) {
        const cryptoInstance = getCryptoInstance();
        return cryptoInstance.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: CryptoConfig.iterations, hash: CryptoConfig.hashAlgorithm }, 
            credential, { name: "AES-GCM", length: CryptoConfig.aesKeyLength }, false, ["encrypt", "decrypt"]
        );
    },

    async encrypt(plaintext, credential) {
        const cryptoInstance = getCryptoInstance();
        const enc = new TextEncoder();
        const salt = cryptoInstance.getRandomValues(new Uint8Array(CryptoConfig.saltLength));
        const iv = cryptoInstance.getRandomValues(new Uint8Array(CryptoConfig.ivLength));
        
        const key = await this._deriveAesKeyFromCredential(credential, salt);
        const ciphertext = await cryptoInstance.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, enc.encode(plaintext)
        );
        
        const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
        
        // ✨ 【终极修复】8KB 分块转换法，彻底免疫 btoa 的 Latin1 异常与内存崩溃！
        let binaryStr = "";
        const chunkSize = 8192;
        for (let i = 0; i < combined.length; i += chunkSize) {
            binaryStr += String.fromCharCode.apply(null, combined.subarray(i, i + chunkSize));
        }
        return btoa(binaryStr);
    },

    async decrypt(base64Data, credential) {
        const cryptoInstance = getCryptoInstance();
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        const sLen = CryptoConfig.saltLength;
        const ivLen = CryptoConfig.ivLength;
        const salt = bytes.slice(0, sLen);
        const iv = bytes.slice(sLen, sLen + ivLen);
        const ciphertext = bytes.slice(sLen + ivLen);
        
        const key = await this._deriveAesKeyFromCredential(credential, salt);
        const decryptedBuffer = await cryptoInstance.subtle.decrypt(
            { name: "AES-GCM", iv: iv }, key, ciphertext
        );
        
        const dec = new TextDecoder();
        return dec.decode(decryptedBuffer);
    }
};
