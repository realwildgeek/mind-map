import exampleData from 'simple-mind-map/example/exampleData'
import { simpleDeepClone } from 'simple-mind-map/src/utils/index'
import Vue from 'vue'
import vuexStore from '@/store'

// 🚨 【核心强注释】：引入极客云端底层引擎
import { getSession, initTripleLayerSecurity } from '@/core/auth.js'
import { fetchCloudList, downloadAndDecrypt, encryptAndUpload, generateSystemFileId } from '@/core/storage.js'

const SIMPLE_MIND_MAP_DATA = 'SIMPLE_MIND_MAP_DATA'
const SIMPLE_MIND_MAP_CONFIG = 'SIMPLE_MIND_MAP_CONFIG'
const SIMPLE_MIND_MAP_LANG = 'SIMPLE_MIND_MAP_LANG'
const SIMPLE_MIND_MAP_LOCAL_CONFIG = 'SIMPLE_MIND_MAP_LOCAL_CONFIG'

let mindMapData = null
// 内存完整数据缓存，防止残缺覆盖
let cloudDataCache = null

// 🌐 【核心强注释】：维护云端多文件与全局索引状态
let currentFileId = new URLSearchParams(window.location.search).get('id') || null
let globalFilesCache = []

// 格式化时间工具
const getFormattedTime = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
}

// 🔒 【核心强注释】：系统启动拦截器，确保安全通行证已驻留
async function ensureSecurity() {
  try {
    getSession() // 探测是否已有会话
    return true
  } catch (e) {
    // 拦截无会话状态，强制输入密码以派生解密密匙
    let pwd = sessionStorage.getItem('geek_master_pwd')
    if (!pwd) {
      pwd = window.prompt("🔐 零知识加密网盘已就绪。请输入主控密码：")
      if (pwd) sessionStorage.setItem('geek_master_pwd', pwd)
    }
    if (pwd) {
      // 这里的 temp_token_for_now 与你的 _middleware 及 route 防线严格对应
      await initTripleLayerSecurity('temp_token_for_now', pwd)
      return true
    }
    return false
  }
}

// 获取思维导图数据
export const getData = async () => {
  if (window.takeOverApp) {
    mindMapData = window.takeOverAppMethods.getMindMapData()
    return mindMapData
  }
  if (vuexStore.state.isHandleLocalFile) {
    return Vue.prototype.getCurrentData()
  }
  
  cloudDataCache = simpleDeepClone(exampleData) // 默认兜底模板

  const isSecure = await ensureSecurity()
  if (!isSecure) {
    console.warn('⛔ 凭证缺失，进入离线内存沙盒模式。')
    return cloudDataCache
  }

  try {
    // 1. 同步拉取云端大厅 KV 索引（为后续保存/列表提供数据基座）
    const { files } = await fetchCloudList()
    globalFilesCache = files || []

    // 2. 解析网址 ID，定向爆破拉取 R2 真身并解密
    if (currentFileId) {
      const content = await downloadAndDecrypt(currentFileId)
      if (content) {
        cloudDataCache = { ...cloudDataCache, ...content }
      } else {
        console.warn('云端实体为空或解密失败，启用默认模板。')
      }
    }
  } catch (error) {
    console.error('云端数据引擎读取异常:', error)
  }

  return cloudDataCache
}

// 存储思维导图数据
export const storeData = async (data) => {
  try {
    let originData = null
    if (window.takeOverApp) {
      originData = mindMapData
    } else {
      originData = cloudDataCache || simpleDeepClone(exampleData)
    }

    if (!originData) originData = {}
    
    // 🧩 【核心强注释】：拼接合并脏数据，防止 R2 被残缺覆盖
    originData = {
      ...originData,
      ...data
    }
    cloudDataCache = originData

    if (window.takeOverApp) {
      mindMapData = originData
      window.takeOverAppMethods.saveMindMapData(originData)
      return
    }
    
    Vue.prototype.$bus.$emit('write_local_file', originData)
    if (vuexStore.state.isHandleLocalFile) return

    // 🚀 【核心强注释】：触发零知识双轨盲化推流
    try {
      getSession() 
    } catch(e) {
      return // 没有驻留密钥，静默放弃云端保存
    }

    // 若为全新文档，则分配上帝 ID 并物理重写浏览器 URL
    if (!currentFileId) {
      currentFileId = generateSystemFileId()
      window.history.pushState(null, '', `/?id=${currentFileId}`)
    }

    // 智能提取根节点名称作为文件标题
    const titleStr = originData.root?.data?.text || "无标题脑图"
    const updateTime = getFormattedTime()

    // 构建/更新上帝索引元数据
    const existingIndex = globalFilesCache.findIndex(f => f.id === currentFileId)
    let creationTime = updateTime
    let currentTags = []
    
    if (existingIndex >= 0) {
        creationTime = globalFilesCache[existingIndex].createdAt || updateTime
        currentTags = globalFilesCache[existingIndex].tags || []
    }

    const metaInfo = { 
      id: currentFileId, 
      title: titleStr, 
      tags: currentTags, 
      createdAt: creationTime, 
      updatedAt: updateTime 
    }

    if (existingIndex >= 0) {
        globalFilesCache[existingIndex] = metaInfo
    } else {
        globalFilesCache.push(metaInfo)
    }
    
    // 强制按最新修改时间排序
    globalFilesCache.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

    // 实施 R2 实体与 KV 目录的并发高强度加密推流
    await encryptAndUpload(currentFileId, originData, metaInfo, null, globalFilesCache)
    
  } catch (error) {
    console.error('云端盲化推流遭遇底层拦截:', error)
    if (error === 'exceeded') Vue.prototype.$bus.$emit('localStorageExceeded')
  }
}

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
