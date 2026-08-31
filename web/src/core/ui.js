// =========================================================================
// 📄 模块名称: ui.js
// 🎯 模块功能: 全局视觉与极简交互控制
// 🛡️ 架构层级: Components 组件层 (纯渲染，无业务状态)
// ⚠️ 依赖规范: 仅处理 CSS 变量切换、DOM class 增删、文字反馈。绝对不包含网络与加密逻辑。
// =========================================================================

// -------------------------------------------------------------------------
// ⚡️ 功能模块: 视觉初始化引线
// -------------------------------------------------------------------------
export function initUI() {
    // 1. 初始化暗黑/亮色主题 (从本地存储读取用户偏好)
    const savedTheme = localStorage.getItem('geek_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // 2. 绑定主题切换按钮
    const themeBtn = document.querySelector('.theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
}

// -------------------------------------------------------------------------
// 🌓 功能模块: 主题调度引擎 (深/浅色无缝切换)
// -------------------------------------------------------------------------
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 切换 DOM 属性并持久化到本地存储
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('geek_theme', newTheme);
}

// -------------------------------------------------------------------------
// 📢 功能模块: 顶部状态日志输出
// -------------------------------------------------------------------------
export function logStatus(msg) { 
    // 🚨 关键修复：已对接 index.html 中实际存在的 ID (status-bar)
    const statusEl = document.getElementById('status-bar');
    if (statusEl) {
        statusEl.innerText = msg;
    }
}

// -------------------------------------------------------------------------
// 🏷️ 功能模块: 标签编辑弹窗 UI
// -------------------------------------------------------------------------
const PRESET_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899'];
export function askForTagDetails(manager, existingTag = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('tagModal');
        const titleEl = document.getElementById('tag-modal-title');
        const inputName = document.getElementById('tag-name-input');
        const colorPicker = document.getElementById('tag-color-picker');
        const parentSelect = document.getElementById('tag-parent-select');
        const btnConfirm = document.getElementById('tag-confirm');
        const btnCancel = document.getElementById('tag-cancel');
        const editActions = document.getElementById('tag-edit-actions');
        const btnDelete = document.getElementById('btn-delete-tag');

        titleEl.innerText = existingTag ? '编辑标签' : '新建标签';
        inputName.value = existingTag ? existingTag.name : '';
        let selectedColor = existingTag ? existingTag.color : PRESET_COLORS[0];
        
        editActions.style.display = existingTag ? 'block' : 'none';

        colorPicker.innerHTML = '';
        PRESET_COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = `color-swatch ${color === selectedColor ? 'selected' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
                swatch.classList.add('selected'); selectedColor = color;
            });
            colorPicker.appendChild(swatch);
        });

        parentSelect.innerHTML = '<option value="">无 (顶级标签) ></option>';
        if (manager && manager.tags) {
            manager.tags.forEach(tag => {
                if (!tag.parentId && (!existingTag || tag.id !== existingTag.id)) { 
                    const opt = document.createElement('option'); opt.value = tag.id; opt.innerText = tag.name + " >";
                    if (existingTag && existingTag.parentId === tag.id) opt.selected = true;
                    parentSelect.appendChild(opt);
                }
            });
        }

        const hasChildren = existingTag && manager && manager.tags.some(t => t.parentId === existingTag.id);
        if (hasChildren) {
            parentSelect.value = ""; parentSelect.disabled = true; parentSelect.style.opacity = "0.5"; parentSelect.style.cursor = "not-allowed";
        } else {
            parentSelect.disabled = false; parentSelect.style.opacity = "1"; parentSelect.style.cursor = "pointer";
        }

        modal.classList.add('active'); setTimeout(() => inputName.focus(), 100);

        const cleanup = () => {
            modal.classList.remove('active'); btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel); 
            btnDelete.removeEventListener('click', onDelete); inputName.removeEventListener('keydown', onEnter);
        };

        const onConfirm = () => {
            const name = inputName.value.trim(); if (!name) return;
            cleanup(); resolve({ action: 'save', data: { name, color: selectedColor, parentId: parentSelect.value || null }});
        };
        const onDelete = () => { cleanup(); resolve({ action: 'delete' }); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onEnter = (e) => { if (e.key === 'Enter') onConfirm(); };

        btnConfirm.addEventListener('click', onConfirm); btnCancel.addEventListener('click', onCancel);
        btnDelete.addEventListener('click', onDelete); inputName.addEventListener('keydown', onEnter);
    });
}

// -------------------------------------------------------------------------
// 📂 功能模块: 侧边栏文件列表渲染
// -------------------------------------------------------------------------
export function renderSidebarRecentList(recentFiles, onFileClick) {
    const listContainer = document.getElementById("cloud-file-list");
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!recentFiles || recentFiles.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">空空如也</div>';
        return;
    }

    recentFiles.forEach(fileObj => {
        const container = document.createElement('div');
        container.className = 'file-item-container';
        container.innerHTML = `<div class="file-item" title="${fileObj.title}" style="width: 100%;">📄 ${fileObj.title}</div>`;
        container.querySelector('.file-item').addEventListener('click', () => onFileClick(fileObj.id));
        listContainer.appendChild(container);
    });
}

// -------------------------------------------------------------------------
// 🏷️ 功能模块: 右侧属性面板标签渲染
// -------------------------------------------------------------------------
export function renderNoteTagsUI(availableTags, currentNoteTags, onTagToggle) {
    const container = document.getElementById('meta-tags-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!availableTags || availableTags.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">暂无可用标签</span>';
        return;
    }

    availableTags.forEach(tag => {
        const isSelected = currentNoteTags.includes(tag.id);
        const capsule = document.createElement('div');
        capsule.style.cssText = `display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 4px 6px 4px 0; border-radius: 12px; font-size: 12px; cursor: pointer; user-select: none; transition: 0.2s; border: 1px solid ${isSelected ? tag.color : 'var(--border-dark)'}; background: ${isSelected ? tag.color + '20' : 'transparent'}; color: ${isSelected ? 'var(--text-main)' : 'var(--text-muted)'};`;
        capsule.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:${tag.color}; opacity:${isSelected ? '1' : '0.3'}; transition: 0.2s;"></span>${tag.name}`;
        capsule.addEventListener('click', () => onTagToggle(tag.id));
        container.appendChild(capsule);
    });
}

// -------------------------------------------------------------------------
// 🗂️ 功能模块: 文件大厅渲染引擎
// -------------------------------------------------------------------------
export function renderFileHallUI(files, tags, activeTagId, onFileClick, onDeleteClick) {
    const gridContainer = document.getElementById('file-grid-container');
    if(!gridContainer) return;
    gridContainer.innerHTML = '';

    if (activeTagId === 'all') {
        gridContainer.innerHTML = `<div style="margin-bottom: 16px; padding: 0 4px;"><input type="text" id="file-search-input" placeholder="搜索文件名称..." class="file-search-input"></div><div class="file-grid" id="all-files-grid"><div style="display: flex; padding: 8px 16px 8px 32px; border-bottom: 1px solid var(--border-light); font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 4px;"><div style="flex: 1;">文件名称</div><div style="width: 150px; text-align: right;">最后修改</div><div style="width: 40px; text-align: center;">操作</div></div></div>`;
        const grid = document.getElementById('all-files-grid');
        const searchInput = document.getElementById('file-search-input');

        const renderFlatFiles = (query) => {
            while (grid.children.length > 1) { grid.removeChild(grid.lastChild); }
            const filtered = files.filter(f => f.title.toLowerCase().includes(query.toLowerCase()));
            if (filtered.length === 0) { grid.insertAdjacentHTML('beforeend', '<div style="color: var(--text-muted); text-align: center; padding: 40px; font-size: 14px;">没有找到匹配的文件 🛸</div>'); return; }

            filtered.forEach(file => {
                const card = document.createElement('div'); card.className = 'file-card';
                let tagsHtml = '';
                if (tags) {
                    file.tags.forEach(tId => {
                        const t = tags.find(tag => tag.id === tId);
                        if(t) tagsHtml += `<span class="inline-tag-pill" style="background-color: ${t.color}15; color: ${t.color}; border: 1px solid ${t.color}30;">${t.name}</span>`;
                    });
                }
                card.innerHTML = `<div class="file-card-icon">📄</div><div class="file-card-name" title="${file.title}">${file.title}<span class="inline-tag-container">${tagsHtml}</span></div><div class="file-card-time">${file.updatedAt || '未知时间'}</div><div class="file-card-delete" title="物理销毁">🗑️</div>`;
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.file-card-delete')) { e.stopPropagation(); onDeleteClick(file.id); return; }
                    onFileClick(file.id);
                });
                grid.appendChild(card);
            });
        };

        renderFlatFiles(''); 
        searchInput.addEventListener('input', (e) => renderFlatFiles(e.target.value));
        return; 
    }

    const groups = {};
    files.forEach(file => {
        if (file.tags.length > 0) {
            file.tags.forEach(tId => { if (!groups[tId]) groups[tId] = []; groups[tId].push(file); });
        }
    });

    let tagsToShow = [];
    if (tags) {
        const target = tags.find(t => t.id === activeTagId);
        if (target) { tagsToShow.push(target); tagsToShow.push(...tags.filter(t => t.parentId === target.id)); }
    }

    const renderGroup = (title, groupFiles) => {
        if (groupFiles.length === 0) return;
        const header = document.createElement('div'); header.className = 'file-group-header';
        header.innerHTML = `<span>🏷️ ${title}</span> <span class="file-group-count">${groupFiles.length} 篇笔记</span>`;
        gridContainer.appendChild(header);

        const grid = document.createElement('div'); grid.className = 'file-grid';
        const listHeader = document.createElement('div');
        listHeader.style.cssText = "display: flex; padding: 8px 16px 8px 32px; border-bottom: 1px solid var(--border-light); font-size: 12px; color: var(--text-muted); font-weight: bold; margin-bottom: 4px;";
        listHeader.innerHTML = `<div style="flex: 1;">文件名称</div><div style="width: 150px; text-align: right;">最后修改</div><div style="width: 40px; text-align: center;">操作</div>`;
        grid.appendChild(listHeader);

        groupFiles.forEach(file => {
            const card = document.createElement('div'); card.className = 'file-card';
            card.innerHTML = `<div class="file-card-icon">📄</div><div class="file-card-name" title="${file.title}">${file.title}</div><div class="file-card-time">${file.updatedAt || '未知时间'}</div><div class="file-card-delete" title="物理销毁">🗑️</div>`;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.file-card-delete')) { e.stopPropagation(); onDeleteClick(file.id); return; }
                onFileClick(file.id);
            });
            grid.appendChild(card);
        });
        gridContainer.appendChild(grid);
    };

    tagsToShow.forEach(tag => {
        const filesInTag = groups[tag.id] || [];
        if (filesInTag.length > 0) renderGroup(tag.name, filesInTag);
    });

    if (gridContainer.innerHTML === '') { gridContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px; font-size: 14px;">该标签下暂无关联笔记 🛸</div>'; }
}

// =========================================================================
// 🔐 核心工具：防偷窥异步密码输入框 (极简居中版)
// =========================================================================
export function askForPassword(message = "请输入密码：") {
    return new Promise((resolve) => {
        // 1. 绝对居中的全屏遮罩 (Flexbox 布局)
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(3px);
            display: flex; justify-content: center; align-items: center;
            z-index: 9999;
        `;

        // 2. 极简白盒容器
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff; padding: 24px; border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            width: 300px; display: flex; flex-direction: column; gap: 16px;
        `;

        // 提示文案
        const desc = document.createElement('div');
        desc.innerText = message;
        desc.style.cssText = `font-size: 14px; color: #333; font-weight: 500; line-height: 1.5;`;

        // 原生密码输入框 (去除花哨样式，克制对齐)
        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = "••••••••";
        input.style.cssText = `
            width: 100%; padding: 10px; border: 1px solid #d9d9d9; 
            border-radius: 4px; font-size: 14px; outline: none; box-sizing: border-box;
            letter-spacing: 2px;
        `;
        input.onfocus = () => input.style.borderColor = '#1890ff';
        input.onblur = () => input.style.borderColor = '#d9d9d9';

        // 按钮组 (右对齐)
        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = `display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px;`;

        const btnCancel = document.createElement('button');
        btnCancel.innerText = "取消";
        btnCancel.style.cssText = `
            padding: 6px 12px; border: 1px solid #d9d9d9; background: #fff; 
            border-radius: 4px; cursor: pointer; font-size: 13px; color: #666;
        `;

        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = "确认";
        btnConfirm.style.cssText = `
            padding: 6px 12px; border: none; background: #1890ff; 
            border-radius: 4px; cursor: pointer; font-size: 13px; color: #fff;
        `;

        // 组装并挂载
        btnGroup.appendChild(btnCancel);
        btnGroup.appendChild(btnConfirm);
        modal.appendChild(desc);
        modal.appendChild(input);
        modal.appendChild(btnGroup);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        input.focus();

        const cleanup = () => { document.body.removeChild(overlay); };

        btnConfirm.addEventListener('click', () => {
            cleanup();
            resolve(input.value); 
        });

        btnCancel.addEventListener('click', () => {
            cleanup();
            resolve(null); 
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnConfirm.click();
            if (e.key === 'Escape') btnCancel.click();
        });
    });
}

// -------------------------------------------------------------------------
// 🏷️ 功能模块: 顶部导航栏下拉标签渲染 (极简双层版)
// -------------------------------------------------------------------------
export function renderNavTagDropdown(tags, selectedIds, onToggle) {
    const dropdown = document.getElementById('nav-tag-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    if (!tags || tags.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px;">暂无可用标签</div>';
        return;
    }

    // 分离出父标签与子标签查询器
    const topLevelTags = tags.filter(t => !t.parentId);
    const getChildren = (parentId) => tags.filter(t => t.parentId === parentId);

    // 核心渲染逻辑
    const renderItem = (tag, isChild) => {
        const isSelected = selectedIds.includes(tag.id);
        const label = document.createElement('label');
        label.className = 'nav-tag-item';
        
        // 🚨 核心逻辑：如果是子标签，在复选框后面硬塞一个 16px 的“物理空格”
        const spaceHtml = isChild ? '<span style="width: 16px; display: inline-block;"></span>' : '';

        label.innerHTML = `
            <input type="checkbox" class="nav-tag-checkbox" ${isSelected ? 'checked' : ''}>
            ${spaceHtml}
            <span class="nav-tag-color-dot" style="background-color: ${tag.color}"></span>
            <span class="nav-tag-name" title="${tag.name}">${tag.name}</span>
        `;

        label.querySelector('input').addEventListener('change', () => onToggle(tag.id));
        dropdown.appendChild(label);
    };

    // O(N) 复杂度的两层平铺循环，拒绝任何性能浪费
    topLevelTags.forEach(parentTag => {
        renderItem(parentTag, false); // 渲染父标签
        getChildren(parentTag.id).forEach(childTag => {
            renderItem(childTag, true); // 渲染子标签
        });
    });
}
