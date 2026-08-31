// =========================================================================
// 📄 模块名称: auth.js
// 🎯 模块功能: 身份鉴权与凭证保险箱 (直接密码加密版)
// 🛡️ 架构层级: Core 底层引擎
// =========================================================================

import { CryptoCore } from './crypto.js';

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

export function logout() {
    ActiveSession.jwt = null;
    ActiveSession.masterCredential = null;
    // 物理重定向，彻底摧毁当前页面的内存状态
    window.location.href = 'https://lt.838808.xyz/api/logout';
}
