// web/src/api/index.js
import exampleData from 'simple-mind-map/example/exampleData'
import { simpleDeepClone } from 'simple-mind-map/src/utils/index'
import Vue from 'vue'
import vuexStore from '@/store'
import { CryptoCore } from '@/core/crypto'
import { getSession, initTripleLayerSecurity } from '@/core/auth'

const SIMPLE_MIND_MAP_DATA = 'SIMPLE_MIND_MAP_DATA'
const SIMPLE_MIND_MAP_CONFIG = 'SIMPLE_MIND_MAP_CONFIG'
const SIMPLE_MIND_MAP_LANG = 'SIMPLE_MIND_MAP_LANG'
const SIMPLE_MIND_MAP_LOCAL_CONFIG = 'SIMPLE_MIND_MAP_LOCAL_CONFIG'

// 从 URL 获取当前脑图 ID，若无则默认为 'my-first-map'
const getFileId = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id') || 'my-first-map';
};

let mindMapData = null
let cloudDataCache = null

// 简易弹窗获取主控密码（保证首次加载时获取解密密钥）
async function ensureMasterCredential() {
  const { masterCredential } = getSession();
  if (masterCredential) return masterCredential;
  
  let pwd = sessionStorage.getItem('geek_master_pwd');
  if (!pwd) {
    pwd = window.prompt("🔐 请输入主控密码以解密云端脑图：");
    if (pwd) sessionStorage.setItem('geek_master_pwd', pwd);
  }
  if (pwd) {
    await initTripleLayerSecurity('temp_token_for_now', pwd);
    return getSession().masterCredential;
  }
  return null;
}

// 获取思维导图数据（解密流程）
export const getData = async () => {
  if (window.takeOverApp) {
    mindMapData = window.takeOverAppMethods.getMindMapData();
    return mindMapData;
  }
  if (vuexStore.state.isHandleLocalFile) {
    return Vue.prototype.getCurrentData();
  }
  
  const fileId = getFileId();
  try {
    const cred = await ensureMasterCredential();
    const { jwt } = getSession();
    
    const res = await fetch(`/api/note/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.r2Payload && cred) {
        // 🔓 WebCrypto 端到端解密
        const decryptedJson = await CryptoCore.decrypt(data.r2Payload, cred);
        cloudDataCache = JSON.parse(decryptedJson);
        return cloudDataCache;
      }
    }
  } catch (error) {
    console.warn('从 R2 解密获取数据失败或文件不存在，加载默认模板', error);
  }
  
  cloudDataCache = simpleDeepClone(exampleData);
  return cloudDataCache;
};

// 存储思维导图数据（加密流程）
export const storeData = async (data) => {
  try {
    let originData = null;
    if (window.takeOverApp) {
      originData = mindMapData;
    } else {
      originData = cloudDataCache || simpleDeepClone(exampleData);
    }

    if (!originData) originData = {};
    
    originData = {
      ...originData,
      ...data
    };
    cloudDataCache = originData;

    if (window.takeOverApp) {
      mindMapData = originData;
      window.takeOverAppMethods.saveMindMapData(originData);
      return;
    }
    
    Vue.prototype.$bus.$emit('write_local_file', originData);
    if (vuexStore.state.isHandleLocalFile) return;

    const cred = await ensureMasterCredential();
    const { jwt } = getSession();
    const fileId = getFileId();

    if (cred) {
      // 🔐 WebCrypto 端到端加密
      const cipherText = await CryptoCore.encrypt(JSON.stringify(originData), cred);
      
      await fetch(`/api/note/${fileId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ r2Payload: cipherText })
      });
    }
  } catch (error) {
    console.error('端到端加密同步至 R2 失败', error);
  }
};

// ==========================================
// 界面配置类函数保持原版不变
// ==========================================
export const getConfig = () => {
  if (window.takeOverApp) return window.takeOverAppMethods.getMindMapConfig();
  let config = localStorage.getItem(SIMPLE_MIND_MAP_CONFIG);
  return config ? JSON.parse(config) : null;
};
export const storeConfig = config => {
  if (window.takeOverApp) return window.takeOverAppMethods.saveMindMapConfig(config);
  try { localStorage.setItem(SIMPLE_MIND_MAP_CONFIG, JSON.stringify(config)); } catch (e) {}
};
export const storeLang = lang => {
  if (window.takeOverApp) return window.takeOverAppMethods.saveLanguage(lang);
  localStorage.setItem(SIMPLE_MIND_MAP_LANG, lang);
};
export const getLang = () => {
  if (window.takeOverApp) return window.takeOverAppMethods.getLanguage() || 'zh';
  let lang = localStorage.getItem(SIMPLE_MIND_MAP_LANG);
  if (lang) return lang;
  storeLang('zh');
  return 'zh';
};
export const storeLocalConfig = config => {
  if (window.takeOverApp) return window.takeOverAppMethods.saveLocalConfig(config);
  localStorage.setItem(SIMPLE_MIND_MAP_LOCAL_CONFIG, JSON.stringify(config));
};
export const getLocalConfig = () => {
  if (window.takeOverApp) return window.takeOverAppMethods.getLocalConfig();
  let config = localStorage.getItem(SIMPLE_MIND_MAP_LOCAL_CONFIG);
  return config ? JSON.parse(config) : null;
};
