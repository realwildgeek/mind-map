import exampleData from 'simple-mind-map/example/exampleData'
import { simpleDeepClone } from 'simple-mind-map/src/utils/index'
import Vue from 'vue'
import vuexStore from '@/store'

const SIMPLE_MIND_MAP_DATA = 'SIMPLE_MIND_MAP_DATA'
const SIMPLE_MIND_MAP_CONFIG = 'SIMPLE_MIND_MAP_CONFIG'
const SIMPLE_MIND_MAP_LANG = 'SIMPLE_MIND_MAP_LANG'
const SIMPLE_MIND_MAP_LOCAL_CONFIG = 'SIMPLE_MIND_MAP_LOCAL_CONFIG'

// 你的 CF Pages R2 接口地址
const API_URL = '/api/map/my-first-map'

let mindMapData = null

// 获取缓存的思维导图数据 (修改为从 R2 异步获取)
export const getData = async () => {
  // 保持作者原有的接管模式判断
  if (window.takeOverApp) {
    mindMapData = window.takeOverAppMethods.getMindMapData()
    return mindMapData
  }
  // 保持作者原有的操作本地文件模式判断
  if (vuexStore.state.isHandleLocalFile) {
    return Vue.prototype.getCurrentData()
  }
  
  // 【修改点：从 R2 获取数据】
  try {
    const res = await fetch(API_URL)
    if (res.ok) {
      const data = await res.json()
      return data || simpleDeepClone(exampleData)
    }
  } catch (error) {
    console.error('从 R2 获取数据失败，使用默认模板', error)
  }
  
  // 如果 R2 获取失败或没数据，返回作者原版的默认数据
  return simpleDeepClone(exampleData)
}

// 存储思维导图数据 (修改为向 R2 推送)
export const storeData = async (data) => {
  try {
    let originData = null
    // 保持作者原有的接管模式数据获取逻辑
    if (window.takeOverApp) {
      originData = mindMapData
    } else {
      // 因为 getData 现在是异步的，这里直接使用传入的 data 进行合并
      // 在实际保存时，传入的 data 通常已经是完整的脑图数据树
      originData = data || {} 
    }

    originData = {
      ...originData,
      ...data
    }

    if (window.takeOverApp) {
      mindMapData = originData
      window.takeOverAppMethods.saveMindMapData(originData)
      return
    }
    
    // 保持作者原有的事件触发逻辑
    Vue.prototype.$bus.$emit('write_local_file', originData)
    if (vuexStore.state.isHandleLocalFile) {
      return
    }

    // 【修改点：将原本的 localStorage.setItem 改为推送到 R2】
    await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(originData)
    })
  } catch (error) {
    console.log(error)
    if (error === 'exceeded') { // 兼容原版逻辑
      Vue.prototype.$bus.$emit('localStorageExceeded')
    }
  }
}

// ==========================================
// 以下所有界面配置相关的函数，一字不改，完全保持原样
// ==========================================

// 获取思维导图配置数据
export const getConfig = () => {
  if (window.takeOverApp) {
    window.takeOverAppMethods.getMindMapConfig()
    return
  }
  let config = localStorage.getItem(SIMPLE_MIND_MAP_CONFIG)
  if (config) {
    return JSON.parse(config)
  }
  return null
}

// 存储思维导图配置数据
export const storeConfig = config => {
  try {
    if (window.takeOverApp) {
      window.takeOverAppMethods.saveMindMapConfig(config)
      return
    }
    localStorage.setItem(SIMPLE_MIND_MAP_CONFIG, JSON.stringify(config))
  } catch (error) {
    console.log(error)
  }
}

// 存储语言
export const storeLang = lang => {
  if (window.takeOverApp) {
    window.takeOverAppMethods.saveLanguage(lang)
    return
  }
  localStorage.setItem(SIMPLE_MIND_MAP_LANG, lang)
}

// 获取存储的语言
export const getLang = () => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.getLanguage() || 'zh'
  }
  let lang = localStorage.getItem(SIMPLE_MIND_MAP_LANG)
  if (lang) {
    return lang
  }
  storeLang('zh')
  return 'zh'
}

// 存储本地配置
export const storeLocalConfig = config => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.saveLocalConfig(config)
  }
  localStorage.setItem(SIMPLE_MIND_MAP_LOCAL_CONFIG, JSON.stringify(config))
}

// 获取本地配置
export const getLocalConfig = () => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.getLocalConfig()
  }
  let config = localStorage.getItem(SIMPLE_MIND_MAP_LOCAL_CONFIG)
  if (config) {
    return JSON.parse(config)
  }
  return null
}
