self.addEventListener('install', (e) => {
    self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
    // 基础 PWA 占位，所有请求直接放行，由你原本的 API 引擎接管
});
