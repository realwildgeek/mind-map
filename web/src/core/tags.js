// ==========================================
// 🏷️ 模块名称: tags.js 
// 🎯 模块功能: 独立/解耦的标签树管理器 (内置 HTML5 拖拽物理引擎)
// ==========================================

export class TagManager {
    constructor(containerId, initialTags = [], onTagsChange) {
        this.container = document.getElementById(containerId);
        this.tags = initialTags;
        this.onTagsChange = onTagsChange;
        this.usedTagIds = new Set(); 
        
        // 拖拽状态缓存
        this.draggedId = null;
        this.dropAction = null;

        this.initDragAndDrop();
        this.render();
    }

    // 🚀 初始化全局拖拽事件代理 (极简高性能)
    initDragAndDrop() {
        if (!this.container) return;

        this.container.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.tag-item');
            if (!item) return;
            this.draggedId = item.dataset.id;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedId); // Firefox 兼容
        });

        this.container.addEventListener('dragover', (e) => {
            e.preventDefault(); // 必须阻止默认事件，否则无法触发 drop
            const item = e.target.closest('.tag-item');
            if (!item || item.dataset.id === this.draggedId) {
                this.clearDropClasses();
                return;
            }

            // 🎯 核心碰撞算法：25/50/25 区域判定
            const rect = item.getBoundingClientRect();
            const y = e.clientY - rect.top;
            
            this.clearDropClasses();

            if (y < rect.height * 0.25) {
                item.classList.add('drop-before');
                this.dropAction = { type: 'before', targetId: item.dataset.id };
            } else if (y > rect.height * 0.75) {
                item.classList.add('drop-after');
                this.dropAction = { type: 'after', targetId: item.dataset.id };
            } else {
                item.classList.add('drop-inside');
                this.dropAction = { type: 'inside', targetId: item.dataset.id };
            }
        });

        this.container.addEventListener('dragleave', (e) => {
            if (!e.target.closest('.tag-item')) {
                this.clearDropClasses();
            }
        });

        this.container.addEventListener('dragend', (e) => {
            const item = e.target.closest('.tag-item');
            if (item) item.classList.remove('dragging');
            this.clearDropClasses();
            this.draggedId = null;
            this.dropAction = null;
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.clearDropClasses();
            if (!this.dropAction || !this.draggedId) return;

            const { type, targetId } = this.dropAction;
            if (this.draggedId !== targetId) {
                this.executeDropLogic(this.draggedId, targetId, type);
            }
            this.draggedId = null;
            this.dropAction = null;
        });
    }

    clearDropClasses() {
        const items = this.container.querySelectorAll('.tag-item');
        items.forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-inside'));
    }

    // 🧠 核心：拖拽数据层变更与越界防御
    executeDropLogic(sourceId, targetId, type) {
        const sourceIndex = this.tags.findIndex(t => t.id === sourceId);
        const sourceTag = this.tags[sourceIndex];
        const targetTag = this.tags.find(t => t.id === targetId);

        const sourceHasChildren = this.tags.some(t => t.parentId === sourceId);
        let actualType = type;
        let intendedParentId = null;

        if (actualType === 'inside') {
            if (targetTag.parentId) {
                actualType = 'after';
                intendedParentId = targetTag.parentId;
            } else {
                intendedParentId = targetTag.id;
            }
        } else {
            intendedParentId = targetTag.parentId;
        }

        // 🛡️ 核心防御：拥有子标签的顶级标签，绝对不能变成别人的子标签！
        if (sourceHasChildren && intendedParentId !== null) {
            return; 
        }

        sourceTag.parentId = intendedParentId;
        this.tags.splice(sourceIndex, 1);
        let newTargetIdx = this.tags.findIndex(t => t.id === targetId);
        
        if (actualType === 'before') {
            this.tags.splice(newTargetIdx, 0, sourceTag);
        } else {
            this.tags.splice(newTargetIdx + 1, 0, sourceTag);
        }

        this.render();
        if (this.onTagsChange) this.onTagsChange(this.tags);
    }

    setUsedTags(usedSet) {
        this.usedTagIds = usedSet;
        this.render();
    }

    buildTree() {
        const tree = [];
        const lookup = {};
        this.tags.forEach(tag => {
            if (!tag.parentId) {
                lookup[tag.id] = { ...tag, children: [] };
                tree.push(lookup[tag.id]);
            }
        });
        this.tags.forEach(tag => {
            if (tag.parentId && lookup[tag.parentId]) {
                lookup[tag.parentId].children.push(tag);
            }
        });
        return tree;
    }

    static generateId() {
        return 'tag_' + Math.random().toString(36).substring(2, 6);
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        const tree = this.buildTree();

        tree.forEach(parentTag => {
            const parentEl = document.createElement('div');
            parentEl.className = 'tag-parent';
            // 接入极客主题系统变量
            const parentDisplayName = parentTag.name + (this.usedTagIds.has(parentTag.id) ? '' : ' <span style="color:var(--text-muted); font-weight:normal;">*</span>');
            
            parentEl.innerHTML = `
                <div class="tag-item" draggable="true" data-id="${parentTag.id}" style="font-weight: 600;">
                    <span class="tag-color-dot" style="background: ${parentTag.color};"></span>
                    <span class="tag-name">${parentDisplayName}</span>
                    <span class="tag-actions btn-edit-tag" title="Edit Tag">✏️</span>
                </div>
            `;
            this.container.appendChild(parentEl);

            parentEl.querySelector('.btn-edit-tag').addEventListener('click', (e) => {
                e.stopPropagation();
                document.dispatchEvent(new CustomEvent('tag-edit', { detail: parentTag }));
            });

            if (parentTag.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tag-children';
                
                parentTag.children.forEach(childTag => {
                    const childEl = document.createElement('div');
                    childEl.className = 'tag-parent'; 
                    const childDisplayName = childTag.name + (this.usedTagIds.has(childTag.id) ? '' : ' <span style="color:var(--text-muted); font-weight:normal;">*</span>');
                    
                    childEl.innerHTML = `
                        <div class="tag-item" draggable="true" data-id="${childTag.id}">
                            <span class="tag-color-dot" style="background: ${childTag.color};"></span>
                            <span class="tag-name">${childDisplayName}</span>
                            <span class="tag-actions btn-edit-tag" title="Edit Tag">✏️</span>
                        </div>
                    `;
                    
                    childEl.querySelector('.btn-edit-tag').addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.dispatchEvent(new CustomEvent('tag-edit', { detail: childTag }));
                    });
                    
                    childrenContainer.appendChild(childEl);
                });
                this.container.appendChild(childrenContainer);
            }
        });
    }

    addTag(name, color, parentId = null) {
        this.tags.push({ id: TagManager.generateId(), name, color, parentId });
        this.render();
        if (this.onTagsChange) this.onTagsChange(this.tags);
    }

    updateTag(id, newName, newColor, newParentId) {
        const tag = this.tags.find(t => t.id === id);
        if (tag) {
            tag.name = newName; tag.color = newColor; tag.parentId = newParentId;
            this.render();
            if (this.onTagsChange) this.onTagsChange(this.tags);
        }
    }

    deleteTag(id) {
        this.tags = this.tags.filter(t => t.id !== id);
        this.tags.forEach(t => { if (t.parentId === id) t.parentId = null; });
        this.render();
        if (this.onTagsChange) this.onTagsChange(this.tags);
    }
}
