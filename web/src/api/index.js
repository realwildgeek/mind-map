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

// ==========================================
// 🛡️ 极客防爆改装：数据指纹快照与提纯引擎
// ==========================================
let lastCloudSavedFingerprint = null 

// 提取纯净数据的指纹（彻底剔除视图缩放、画布拖拽等无效噪音）
const getDataFingerprint = (data) => {
  if (!data) return '';
  const pureData = {
    root: data.root,       // 核心节点树
    theme: data.theme,     // 主题配色
    layout: data.layout,   // 结构布局
    config: data.config    // 个性化配置
  };
  // 转为字符串作为极简版 Hash 指纹
  return JSON.stringify(pureData);
}
// ==========================================

// 🌐 【核心强注释】：维护云端多文件与全局索引状态
let currentFileId = new URLSearchParams(window.location.search).get('id')
const isForceNew = new URLSearchParams(window.location.search).get('new') === '1'

// 🚀 极客智能路由分发中心 (Local Context Snapshot)
if (isForceNew) {
    // 0. 强行新建模式：清除记忆，静默抹除 URL 中的 new 标识，给一张纯净白板，不弹大厅
    localStorage.removeItem('geek_last_opened_id')
    window.history.replaceState(null, '', '/')
} else if (!currentFileId) {
    const lastOpenedId = localStorage.getItem('geek_last_opened_id')
    if (lastOpenedId) {
        // 1. 存在历史快照，瞬间重定向恢复现场 (不留历史记录)
        window.location.replace(`/?id=${lastOpenedId}`)
    } else {
        // 2. 无记忆 (新设备/已注销)，挂载完成后自动呼出文件大厅
        setTimeout(() => {
            document.getElementById('geek-island')?.classList.remove('active')
            document.getElementById('fileBrowserModal')?.classList.add('active')
            if(window.showGeekToast) window.showGeekToast('👋 欢迎，请选择或新建脑图')
        }, 800)
    }
} else {
    // 3. 只要显式携带 ID 访问，就更新本地快照
    localStorage.setItem('geek_last_opened_id', currentFileId)
}

let globalFilesCache = []
let globalTagsCache = []

// 🚨 完美复刻 main.js：独立的当前脑图标签状态 
let currentNoteTags = []

// 🧠 属性面板 UI 精准轰炸函数 (完美适配 Grid 与胶囊 UI)
const refreshMetaUI = (forceCreated, forceUpdated) => {
    // 🚨 修正：精确瞄准你 HTML 里的真实 ID
    const metaCreated = document.getElementById('meta-created-time');
    const metaUpdated = document.getElementById('meta-updated-time');
    const metaTagsContainer = document.getElementById('meta-tags-container'); 

    let created = forceCreated;
    let updated = forceUpdated;

    // 如果未传时间，则从全局缓存抓取兜底
    if (!created || !updated) {
        const fileMeta = globalFilesCache.find(f => f.id === currentFileId);
        if (fileMeta) {
            created = created || fileMeta.createdAt;
            updated = updated || fileMeta.updatedAt;
        }
    }

    if (metaCreated && created) metaCreated.innerText = created;
    if (metaUpdated && updated) metaUpdated.innerText = updated;

    // 动态生成彩色 Pill 胶囊标签
    if (metaTagsContainer) {
        metaTagsContainer.innerHTML = ''; // 先清空旧数据
        
        if (currentNoteTags.length === 0) {
            metaTagsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 13px;">无</span>';
        } else {
            currentNoteTags.forEach(id => {
                const t = globalTagsCache.find(gt => gt.id === id);
                const tagName = t ? t.name : id;
                const tagColor = t ? t.color : '#888'; // 默认极客灰
                
                // 动态构建胶囊 DOM
                const pill = document.createElement('div');
                pill.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    background: ${tagColor}20; /* 20%透明度背景 */
                    color: ${tagColor};
                    border: 1px solid ${tagColor}40;
                `;
                pill.innerText = tagName;
                metaTagsContainer.appendChild(pill);
            });
        }
    }
}

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
        
        // 🚨 核心修复：拉取数据后，立刻更新本地标签状态并刷新属性面板
        const fileMeta = globalFilesCache.find(f => f.id === currentFileId)
        if (fileMeta) {
            currentNoteTags = fileMeta.tags || []
            refreshMetaUI(fileMeta.createdAt, fileMeta.updatedAt)
        }
      } else {
        console.warn('云端实体为空或解密失败，启用默认模板。')
      }
    }
  } catch (error) {
    console.error('云端数据引擎读取异常:', error)
  }

  // 🛡️ 核心植入：初次加载完毕后，立刻拍下纯净数据的初始指纹
  lastCloudSavedFingerprint = getDataFingerprint(cloudDataCache)

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

    // ==========================================
    // 🛡️ 第一层防御：纯净数据指纹比对 (Diffing 拦截)
    // ==========================================
    const currentFingerprint = getDataFingerprint(originData);

    // 1. 如果骨架内容毫无变化（仅仅是拖拽了画布），且不是手动强制保存，直接静默拦截！
    if (currentFingerprint === lastCloudSavedFingerprint && !window.__isManualCloudSave) {
        return; 
    }

    // 2. 智能探测空壳垃圾：如果是无 ID 的新文件，且内容连一个字都没改，坚决不自动推流！
    if (!currentFileId && !window.__isManualCloudSave) {
        const isDefaultEmpty = originData.root?.data?.text === '根节点' && (!originData.root?.children || originData.root.children.length === 0);
        if (isDefaultEmpty) {
            return; 
        }
    }
    // ==========================================

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
    
    if (existingIndex >= 0) {
        creationTime = globalFilesCache[existingIndex].createdAt || updateTime
    }

    const metaInfo = { 
      id: currentFileId, 
      title: titleStr, 
      tags: currentNoteTags, // 🚨 核心修复：直接读取独立维护的内存状态
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
    
    // 🛡️ 盲化推流成功后，立刻更新本地内存的指纹快照，等待下一次比对
    lastCloudSavedFingerprint = currentFingerprint;

    // 🚨 核心修复：盲化推流成功后，立刻使用新时间戳轰炸 UI
    refreshMetaUI(creationTime, updateTime);
    
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
  // 1. 绑定 [新建脑图] (加入未保存差异拦截机制)
  document.getElementById('btn-more-new')?.addEventListener('click', () => {
    // 检查当前是否有未保存的内容
    const currentFingerprint = getDataFingerprint(cloudDataCache);
    if (currentFingerprint !== lastCloudSavedFingerprint) {
      const confirmNew = confirm('当前脑图有未保存的修改，直接新建将丢失这些更改，是否继续？');
      if (!confirmNew) return;
    }
    
    // 🚨 核心修复：带上强制新建通行证 (?new=1)，打断路由的恢复记忆逻辑
    window.location.href = '/?new=1'
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
    // 🚨 新增：遍历文件缓存，盘点所有正在使用的标签，并同步给侧边栏引擎
    if (tagManagerInstance && typeof tagManagerInstance.setUsedTags === 'function') {
        const usedTags = new Set();
        globalFilesCache.forEach(f => {
            if (f.tags && Array.isArray(f.tags)) {
                f.tags.forEach(id => usedTags.add(id));
            }
        });
        tagManagerInstance.setUsedTags(usedTags);
    }
    
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

  // 4. 绑定 [安全同步] 
  const triggerSave = async () => { // 👈 加上 async
    document.getElementById('geek-island').classList.remove('active')
    
    window.__isManualCloudSave = true; 
    // 🚨 核心修复：加上 await，强制等待推流完成再关锁，防止 Babel 异步吞锁
    await storeData(Vue.prototype.getCurrentData ? Vue.prototype.getCurrentData() : {})
    window.__isManualCloudSave = false; 
    
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

    const currentFileTags = currentNoteTags; // 🚨 渲染时，直接对照内存状态

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

  // 9. 极客式“点选即存”同步联动
  document.getElementById('file-tag-list')?.addEventListener('change', async (e) => { // 👈 加上 async
    if (e.target.classList.contains('file-tag-checkbox')) {
        if (!currentFileId) return
        
        const checkboxes = document.querySelectorAll('.file-tag-checkbox:checked')
        
        // 🚨 瞬间更新内存状态，并立刻体现到悬浮面板
        currentNoteTags = Array.from(checkboxes).map(cb => cb.value)
        refreshMetaUI()

        window.__isManualCloudSave = true;
        // 🚨 核心修复：加上 await
        await storeData(Vue.prototype.getCurrentData ? Vue.prototype.getCurrentData() : {})
        window.__isManualCloudSave = false;
        
        if(window.showGeekToast) window.showGeekToast('🏷️ 标签已实时同步')
    }
  })

  // 10. 绑定 [大厅标签筛选] (DOM 事件委托模式)
  const sidebarList = document.getElementById('tag-sidebar-list');
  if (sidebarList) {
      sidebarList.addEventListener('click', (e) => {
          // 精准捕获点击的标签实体
          const item = e.target.closest('.tag-item');
          
          // 排除掉对“编辑/删除”按钮的误触
          if (item && !e.target.closest('.btn-edit-tag')) { 
              // 剥夺所有标签和“全部文档”的高亮状态
              document.querySelectorAll('.modal-sidebar .tag-item').forEach(el => el.classList.remove('active'));
              const viewAllBtn = document.getElementById('view-all-files');
              if (viewAllBtn) viewAllBtn.classList.remove('active');
              
              // 赋予当前点击项高亮状态
              item.classList.add('active');
              
              // 提取数据集中的 ID，并触发大厅重绘
              const tagId = item.dataset.id;
              if (typeof refreshHallUI === 'function') {
                  refreshHallUI(tagId);
              }
          }
      });
  }

  // 11. 绑定 [查看全部文档] 恢复初始视图
  const viewAllBtn = document.getElementById('view-all-files');
  if (viewAllBtn) {
      viewAllBtn.addEventListener('click', (e) => {
          // 剥夺所有标签的高亮状态
          document.querySelectorAll('.modal-sidebar .tag-item').forEach(el => el.classList.remove('active'));
          // 点亮“全部文档”
          e.currentTarget.classList.add('active');
          
          // 传回 'all' 标识符，重绘大厅
          if (typeof refreshHallUI === 'function') {
              refreshHallUI('all');
          }
      });
  }

}, 1000)
