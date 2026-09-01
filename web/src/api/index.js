import exampleData from 'simple-mind-map/example/exampleData'
import { simpleDeepClone } from 'simple-mind-map/src/utils/index'
import Vue from 'vue'
import vuexStore from '@/store'

// 🚨 【核心强注释】：引入极客云端底层引擎
import { getSession, initTripleLayerSecurity } from '@/core/auth.js'
import { fetchCloudList, downloadAndDecrypt, encryptAndUpload, generateSystemFileId, deleteNote, updateCloudTags } from '@/core/storage.js'
import { renderFileHallUI, askForTagDetails } from '@/core/ui.js'
import { TagManager } from '@/core/tags.js'
import { logout } from '@/core/auth.js'

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
let globalTagsCache = [] // 新增

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
    const { files, tags } = await fetchCloudList()
    globalFilesCache = files || []
    globalTagsCache = tags || [] // <--- 新增这行，把标签树也存到内存里

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

// =======================================================
// ☁️ 极客灵动岛交互与文件大厅粘合剂 (2.0 抽屉版)
// =======================================================
let tagManagerInstance = null

setTimeout(() => {
  // 1. 绑定 [新建终端] (仅在更多菜单)
  document.getElementById('btn-more-new')?.addEventListener('click', () => {
    window.location.href = '/'
  })

  // 2. 绑定 [文件大厅] (主干道 & 更多菜单双重绑定)
  const openHallUI = () => {
    document.getElementById('geek-island').classList.remove('active') // 收起抽屉
    document.getElementById('fileBrowserModal').classList.add('active')
    document.querySelector('.modal-sidebar').classList.add('tags-collapsed')

    if (!tagManagerInstance) {
      tagManagerInstance = new TagManager('tag-sidebar-list', globalTagsCache, async (newTags) => {
        globalTagsCache = newTags
        await updateCloudTags(newTags) 
        refreshHallUI('all')
      })
    }
    refreshHallUI('all')
  }
  document.getElementById('btn-main-hall')?.addEventListener('click', openHallUI)
  document.getElementById('btn-more-hall')?.addEventListener('click', openHallUI)

  // 3. 渲染大厅的核心逻辑
  function refreshHallUI(activeTagId = 'all') {
    renderFileHallUI(
      globalFilesCache, 
      globalTagsCache, 
      activeTagId,
      (fileId) => { window.location.href = `/?id=${fileId}` },
      async (fileId) => { 
        if (confirm("⚠️ 确认在云端彻底抹除该脑图？此操作不可逆！")) {
          globalFilesCache = globalFilesCache.filter(f => f.id !== fileId)
          await deleteNote(fileId, globalFilesCache)
          refreshHallUI(activeTagId)
        }
      }
    )
  }

  // 绑定：关闭大厅模态框
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    document.getElementById('fileBrowserModal').classList.remove('active')
  })

  // 4. 绑定 [安全同步] (主干道 & 更多菜单双重绑定)
  const triggerSave = () => {
    document.getElementById('geek-island').classList.remove('active')
    storeData(Vue.prototype.getCurrentData ? Vue.prototype.getCurrentData() : {})
    if(window.showGeekToast) window.showGeekToast('✅ 手动安全同步完成')
  }
  document.getElementById('btn-main-save')?.addEventListener('click', triggerSave)
  document.getElementById('btn-more-save')?.addEventListener('click', triggerSave)

  // 5. 绑定 [物理拔线] (退出登录)
  document.getElementById('btn-more-logout')?.addEventListener('click', () => {
    logout()
  })

  // (注: btn-more-encrypt 的独立加密预留在 HTML onclick 中实现了，无需在此绑定)

  // 6. 绑定 [新建标签] (大厅内)
  document.getElementById('btn-add-tag')?.addEventListener('click', async () => {
    const result = await askForTagDetails(tagManagerInstance)
    if (result && result.action === 'save') { 
      tagManagerInstance.addTag(result.data.name, result.data.color, result.data.parentId) 
    }
  })

  // 7. 监听 [编辑/删除标签] 全局事件 (大厅内)
  document.addEventListener('tag-edit', async (e) => {
    const tag = e.detail
    const result = await askForTagDetails(tagManagerInstance, tag)
    if (result) {
      if (result.action === 'save') { 
        tagManagerInstance.updateTag(tag.id, result.data.name, result.data.color, result.data.parentId) 
      } else if (result.action === 'delete') {
        if (confirm(`🗑️ 确定要删除标签 "${tag.name}" 吗？\n删除后无法恢复！`)) {
          tagManagerInstance.deleteTag(tag.id)
        }
      } 
    }
  })

  // 8. 绑定 [打标签] 气泡桥梁渲染 (树状层级复刻)
  document.getElementById('btn-main-tag')?.addEventListener('click', () => {
    if (!currentFileId) {
      if(window.showGeekToast) window.showGeekToast('⚠️ 请先保存脑图再打标签', true)
      setTimeout(() => document.getElementById('popover-tag')?.classList.remove('active'), 10)
      return
    }
    
    const listContainer = document.getElementById('file-tag-list')
    listContainer.innerHTML = ''

    const fileMeta = globalFilesCache.find(f => f.id === currentFileId)
    const currentFileTags = fileMeta?.tags || []

    if (globalTagsCache.length === 0) {
        listContainer.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px;">暂无标签，请先在文件大厅新建。</div>'
    } else {
        // 🚨 核心复刻：递归渲染树状结构与缩进
        function renderTagTree(tags, parentId = '', level = 0) {
            let html = '';
            const children = tags.filter(t => (t.parentId || '') === parentId);
            children.forEach(tag => {
                const isChecked = currentFileTags.includes(tag.id) ? 'checked' : '';
                const paddingLeft = 16 + level * 20; // 根据层级计算缩进距离
                html += `
                  <label class="island-tag-row" style="padding-left: ${paddingLeft}px;">
                    <input type="checkbox" value="${tag.id}" class="file-tag-checkbox" ${isChecked}>
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${tag.color}; flex-shrink: 0;"></div>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tag.name}</span>
                  </label>
                `;
                html += renderTagTree(tags, tag.id, level + 1);
            });
            return html;
        }
        listContainer.innerHTML = renderTagTree(globalTagsCache);
    }
  })

  // 9. 极客式“点选即存”同步联动 (抛弃保存按钮)
  document.getElementById('file-tag-list')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('file-tag-checkbox')) {
        if (!currentFileId) return
        
        // 瞬间抓取所有已勾选的框
        const checkboxes = document.querySelectorAll('.file-tag-checkbox:checked')
        const selectedTagIds = Array.from(checkboxes).map(cb => cb.value)

        const fileIndex = globalFilesCache.findIndex(f => f.id === currentFileId)
        if (fileIndex >= 0) {
          globalFilesCache[fileIndex].tags = selectedTagIds
          
          // 触发盲化推流
          storeData(Vue.prototype.getCurrentData ? Vue.prototype.getCurrentData() : {})
          
          if(window.showGeekToast) window.showGeekToast('🏷️ 标签已实时同步')
          
          // 瞬间刷新 ⓘ 面板里的胶囊，实现数据联动
          if(typeof window.updateMetaInfoUI === 'function') window.updateMetaInfoUI()
        }
    }
  })
}, 1000)
