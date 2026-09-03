// =========================================================================
// ☁️ 模块名称: storage.js
// 🎯 模块功能: 零知识云端通信引擎 (R2 + KV 上帝之眼双键版 / Master JSON 驱动)
// 🛡️ 架构层级: Network / Data Layer
// =========================================================================

import { getSession } from './auth.js';
import { CryptoCore } from './crypto.js'; 

// -------------------------------------------------------------------------
// 🔌 内部工具：带鉴权的极客 Fetch 封装
// -------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
    const { jwt } = getSession(); 
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        ...options.headers
    };

    const response = await fetch(`/api${endpoint}`, { ...options, headers });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP 异常: ${response.status}`);
    }
    return response.json();
}

// -------------------------------------------------------------------------
// 📡 核心业务流：拉取云端大厅 (瞬间解密文件与标签的全量目录)
// -------------------------------------------------------------------------
export async function fetchCloudList() {
    const { masterCredential } = getSession(); 
    const data = await apiFetch('/list');
    
    let decryptedFiles = [];
    if (data.filesCipher) {
        try {
            const plainJsonStr = await CryptoCore.decrypt(data.filesCipher, masterCredential);
            decryptedFiles = JSON.parse(plainJsonStr);
        } catch (e) {
            console.error("解密文件上帝索引失败");
        }
    }

    let decryptedTags = [];
    if (data.tagsCipher) {
        try {
            const plainTagsStr = await CryptoCore.decrypt(data.tagsCipher, masterCredential);
            decryptedTags = JSON.parse(plainTagsStr);
        } catch (e) {
            console.error("解密标签上帝索引失败");
        }
    }

    return { 
        files: decryptedFiles, 
        tags: decryptedTags
    };
}

// -------------------------------------------------------------------------
// 📥 核心业务流：从 R2 下载真身，解密并解析 Master JSON
// -------------------------------------------------------------------------
export async function downloadAndDecrypt(fileId, wrappedKey, customCred) {
    const { masterCredential } = getSession();
    const activeCredential = customCred || masterCredential;

    const data = await apiFetch(`/file/${fileId}`);
    const ciphertextR2 = data.r2Payload;
    
    if (!ciphertextR2) return null;

    const rawJsonStr = await CryptoCore.decrypt(ciphertextR2, activeCredential);
    try {
        const masterPackage = JSON.parse(rawJsonStr);
        return masterPackage.content; // 返回 Delta 核心载荷
    } catch (e) {
        // 向后兼容旧格式或空内容异常
        return null;
    }
}

// -------------------------------------------------------------------------
// 📤 核心业务流：双轨盲化加密 (Master JSON 全量推流)
// -------------------------------------------------------------------------
export async function encryptAndUpload(fileId, deltaContent, metaInfo, customCred, globalFilesArray) {
    const { masterCredential } = getSession();
    const activeCredential = customCred || masterCredential;

    // 1. 组装 Master JSON 信封
    const masterPackage = {
        meta: metaInfo,
        content: deltaContent
    };
    const ciphertextR2 = await CryptoCore.encrypt(JSON.stringify(masterPackage), activeCredential);

    // 2. 铸造 KV 上帝密文 (全量目录加密)
    const ciphertextKV = await CryptoCore.encrypt(JSON.stringify(globalFilesArray), masterCredential);

    // 3. 并发双轨推流
    await Promise.all([
        apiFetch(`/file/${fileId}`, { method: 'PUT', body: JSON.stringify({ r2Payload: ciphertextR2 }) }),
        apiFetch(`/list`, { method: 'PUT', body: JSON.stringify({ filesCipher: ciphertextKV }) })
    ]);

    return true;
}

// -------------------------------------------------------------------------
// 🧨 核心业务流：物理销毁 (传入更新后的大厅数组覆写 KV)
// -------------------------------------------------------------------------
export async function deleteNote(fileId, newGlobalFilesArray) {
    const { masterCredential } = getSession();
    const ciphertextKV = await CryptoCore.encrypt(JSON.stringify(newGlobalFilesArray), masterCredential);
    
    await Promise.all([
        apiFetch(`/file/${fileId}`, { method: 'DELETE' }),
        apiFetch(`/list`, { method: 'PUT', body: JSON.stringify({ filesCipher: ciphertextKV }) })
    ]);
    return true;
}

// -------------------------------------------------------------------------
// 🏷️ 核心业务流：更新 KV 标签树 (彻底盲化版)
// -------------------------------------------------------------------------
export async function updateCloudTags(newTags) {
    const { masterCredential } = getSession();
    const tagsCipher = await CryptoCore.encrypt(JSON.stringify(newTags), masterCredential);

    await apiFetch('/tags', {
        method: 'PUT',
        body: JSON.stringify({ tagsCipher }) 
    });
    return true;
}

// -------------------------------------------------------------------------
// 🆔 工具：生成全局唯一的无中线 32 位 ID
// -------------------------------------------------------------------------
export function generateSystemFileId() {
    return crypto.randomUUID().replace(/-/g, '');
}
