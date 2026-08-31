// =========================================================================
// ☁️ 模块名称: functions/api/[[route]].js
// 🎯 模块功能: Cloudflare Pages Serverless (上帝之眼双键版)
// =========================================================================

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');
    const method = request.method;

    // 🚨 核心修复点：定义严格的动态 API 响应头，彻底打穿并禁用所有层级的缓存
    const apiHeaders = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    // 🛡️ Layer 1: JWT 防线
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== 'Bearer temp_token_for_now') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: apiHeaders });
    }

    try {
        // 🗂️ [GET /api/list] 瞬间拉取全量双键索引
        if (path === 'list' && method === 'GET') {
            const filesCipher = await env.KV_STORE.get('global_files') || "";
            const tagsCipher = await env.KV_STORE.get('global_tags') || ""; 
            // 注入 apiHeaders
            return new Response(JSON.stringify({ filesCipher, tagsCipher }), { status: 200, headers: apiHeaders });
        }

        // 🗂️ [PUT /api/list] 全量覆盖文件索引黑盒
        if (path === 'list' && method === 'PUT') {
            const body = await request.json();
            await env.KV_STORE.put('global_files', body.filesCipher);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: apiHeaders });
        }

        // 🏷️ [PUT /api/tags] 全量覆盖标签树
        if (path === 'tags' && method === 'PUT') {
            const body = await request.json();
            await env.KV_STORE.put('global_tags', body.tagsCipher);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: apiHeaders });
        }

        // 📝 路由: R2 实体专线 (只管文件本体，不管 KV 目录)
        if (path.startsWith('note/')) {
            const fileId = path.split('/').pop(); 
            if (method === 'GET') {
                const object = await env.R2_STORE.get(fileId); 
                if (!object) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: apiHeaders });
                return new Response(JSON.stringify({ r2Payload: await object.text() }), { status: 200, headers: apiHeaders });
            }
            if (method === 'PUT') {
                const body = await request.json();
                await env.R2_STORE.put(fileId, body.r2Payload);
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: apiHeaders });
            }
            if (method === 'DELETE') {
                await env.R2_STORE.delete(fileId);
                return new Response(JSON.stringify({ success: true }), { status: 200, headers: apiHeaders });
            }
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: apiHeaders });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: apiHeaders });
    }
}
