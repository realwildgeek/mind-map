// 安装阶段：跳过等待，立即接管
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// 激活阶段：立即控制所有客户端页面
self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

// 🚀 核心修复：标准的网络直通车，消除 no-op 警告
self.addEventListener('fetch', (e) => {
    // 拦截请求，并主动使用 fetch API 转发出去，不再是“无所事事”的空函数
    e.respondWith(
        fetch(e.request).catch(() => {
            // 可选：当用户真正断网时，可以在这里返回一个自定义的离线 Response 提示
            console.warn('当前处于离线状态');
        })
    );
});
