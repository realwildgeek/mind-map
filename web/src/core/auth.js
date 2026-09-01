// =========================================================================
// 📄 模块名称: auth.js
// 🎯 模块功能: 身份鉴权与凭证保险箱 (直接密码加密版)
// 🛡️ 架构层级: Core 底层引擎
// =========================================================================

import { CryptoCore } from '@/core/crypto';

const ActiveSession = {
    jwt: null,
    masterCredential: null 
};

export async function initTripleLayerSecurity(jwtToken, masterPasswordStr) {
    if (!jwtToken || !masterPasswordStr) throw new Error("初始化中断：凭证缺失");
    
    ActiveSession.jwt = jwtToken;
    // 降级为直接密码模式：直接用用户输入的密码铸造全局加密凭证
    ActiveSession.masterCredential = await CryptoCore.createCredential(masterPasswordStr);
    
    return true;
}

export function getSession() {
    if (!ActiveSession.jwt || !ActiveSession.masterCredential) throw new Error("Unauthorized: 凭证不完整或已丢失");
    return {
        jwt: ActiveSession.jwt,
        masterCredential: ActiveSession.masterCredential
    };
}

// 🎯 终极物理拔线：异步白名单焦土清理
export async function logout() {
    ActiveSession.jwt = null;
    ActiveSession.masterCredential = null;
    
    // 1. ☢️ 烧毁会话缓存：彻底清空主控密码及临时状态
    sessionStorage.clear(); 
    
    // 2. 🛡️ 局部焦土清理：执行 localStorage 白名单机制
    const keysToKeep = [
        'SIMPLE_MIND_MAP_CONFIG', 
        'SIMPLE_MIND_MAP_LANG', 
        'SIMPLE_MIND_MAP_LOCAL_CONFIG'
    ];
    
    // 逆向遍历删除，防止数组塌陷遗漏
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
        }
    }

    // 3. 💥 深度清洗 IndexedDB：防止任何第三方富文本插件遗留离线大文件
    try {
        // 现代浏览器 API，动态获取当前域名下所有数据库并摧毁
        if (window.indexedDB && window.indexedDB.databases) {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                window.indexedDB.deleteDatabase(db.name);
            }
        }
    } catch (e) {
        console.warn('IndexedDB 清理受限', e);
    }
    
    // 4. 🚪 强制跃迁：跳转相对路径，交由 _middleware.js 执行最后的 Cookie 销毁
    window.location.href = '/logout';
}
