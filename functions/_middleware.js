// ==========================================
// 🛡️ 子项目万能边缘门卫：绝对通用，零个性化硬编码
// ==========================================

// ==========================================
// ⚙️ 全局配置与变量 (绝对置顶)
// ==========================================
const CONFIG = {
    // 🌐 全域主枢纽 (唯一需要维护的生态节点)
    SSO_ORIGIN: 'https://sso.838808.xyz',             
    
    // 🚦 基础控制参数
    PUBLIC_PATHS: ['/favicon.ico', '/public.html'],   
    LOGOUT_PATH: '/logout',                           
    PROXY_PAGE: '/index.html',                        
    
    // 🎟️ 护照规范
    COOKIE_NAME: 'jwt',                               
    LOGOUT_COOKIE_TPL: 'jwt=deleted; {DOMAIN} HttpOnly; Secure; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
};

// ------------------------------------------
// 🛠️ 纯函数工具模块 (零外部依赖)
// ------------------------------------------
function getCookie(request, name) {
    const cookieString = request.headers.get('Cookie');
    if (!cookieString) return null;
    const cookies = cookieString.split(';');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) return cookieValue;
    }
    return null;
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) { str += '='; }
    return atob(str);
}

async function verifyJWT(token, secret) {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const signature = new Uint8Array(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
        const isValid = await crypto.subtle.verify("HMAC", key, signature, data);
        if (!isValid) return null;
        return JSON.parse(decodeURIComponent(escape(base64UrlDecode(payloadB64))));
    } catch (e) {
        return null;
    }
}

// ------------------------------------------
// 🚀 核心拦截与万能代理主程序
// ------------------------------------------
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 1. 注销动作极简拦截
    if (url.pathname === CONFIG.LOGOUT_PATH) {
        const domainAttr = env.ROOT_DOMAIN ? `Domain=.${env.ROOT_DOMAIN};` : "";
        const killCookie = CONFIG.LOGOUT_COOKIE_TPL.replace('{DOMAIN}', domainAttr);
        return new Response(null, {
            status: 302,
            headers: { "Location": "/", "Set-Cookie": killCookie }
        });
    }

    // 2. 静态资源白名单放行
    if (CONFIG.PUBLIC_PATHS.includes(url.pathname)) return next();

    // 3. 边缘护照查验
    const token = getCookie(request, CONFIG.COOKIE_NAME);
    let payload = null;
    if (token) {
        payload = await verifyJWT(token, env.JWT_SECRET);
    }

    // 4. 核心魔术：无护照时，执行万能代理渲染
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
        try {
            const ssoResponse = await fetch(`${CONFIG.SSO_ORIGIN}${CONFIG.PROXY_PAGE}`);
            let html = await ssoResponse.text();

            // 🪄 万能转换法则 A：自动接管 API 指向
            // 匹配 API_BASE: '/api' 并重写为主基地绝对地址
            html = html.replace(/API_BASE:\s*['"]\/api['"]/g, `API_BASE: '${CONFIG.SSO_ORIGIN}/api'`);
            
            // 🪄 万能转换法则 B：智能重写相对路径资源 (js/css/png/svg/ico)
            // 排除绝对路径(http/https/data)，匹配并替换所有的 ./ 或 / 开头的静态资源
            html = html.replace(/(src|href)=['"](?!\w+:|\/\/)(?:\.\/|\/)?([^'"]+\.(?:js|css|png|svg|ico))['"]/gi, `$1="${CONFIG.SSO_ORIGIN}/$2"`);

            return new Response(html, {
                headers: { "Content-Type": "text/html;charset=UTF-8" }
            });
        } catch (error) {
            return new Response("身份认证中心网络异常，请稍后再试", { status: 500 });
        }
    }

    // 5. 护照合法，物理放行，进入业务执行区
    return next();
}
