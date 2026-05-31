// Multi-Protocol Proxy Worker Template
// 支持 VLESS、VMess、Trojan、Shadowsocks 多协议
// 使用 KV 存储用户数据，包含管理面板

// 配置变量（部署时替换）
const ADMIN_PASSWORD = "{{ADMIN_PASSWORD}}";
const WORKER_NAME = "{{WORKER_NAME}}";
const WORKER_HOST = "{{WORKER_HOST}}";
const ENABLED_PROTOCOLS = {{ENABLED_PROTOCOLS}}; // ["vless", "vmess", "trojan", "shadowsocks"]

// 管理面板 HTML
const ADMIN_PANEL_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多协议代理管理面板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .tabs {
            display: flex;
            border-bottom: 2px solid #e0e0e0;
            background: #f5f5f5;
        }
        .tab {
            padding: 15px 30px;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 16px;
            color: #666;
            transition: all 0.3s;
        }
        .tab:hover { background: #e0e0e0; }
        .tab.active {
            background: white;
            color: #667eea;
            font-weight: 600;
            border-bottom: 3px solid #667eea;
        }
        .content {
            padding: 30px;
            display: none;
        }
        .content.active { display: block; }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border 0.3s;
        }
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        .btn-danger:hover {
            background: #dc2626;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
        }
        .stats-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-card h3 {
            font-size: 32px;
            margin-bottom: 5px;
        }
        .stat-card p {
            opacity: 0.9;
            font-size: 14px;
        }
        .subscription-box {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .subscription-box input {
            flex: 1;
            padding: 10px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
        }
        .protocol-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 5px;
        }
        .badge-vless { background: #3b82f6; color: white; }
        .badge-vmess { background: #10b981; color: white; }
        .badge-trojan { background: #f59e0b; color: white; }
        .badge-shadowsocks { background: #8b5cf6; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 多协议代理管理面板</h1>
            <p>Worker: ${WORKER_NAME} | Host: ${WORKER_HOST}</p>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('dashboard')">📊 仪表盘</button>
            <button class="tab" onclick="switchTab('users')">👥 用户管理</button>
            <button class="tab" onclick="switchTab('subscription')">📡 订阅管理</button>
        </div>
        
        <div id="tab-dashboard" class="content active">
            <h2>📊 统计概览</h2>
            <div class="stats-cards" id="stats-cards"></div>
            <div id="protocol-info"></div>
        </div>
        
        <div id="tab-users" class="content">
            <h2>👥 用户管理</h2>
            <div class="form-group">
                <label>协议类型</label>
                <select id="user-protocol">
                    <!-- 协议选项将由 JavaScript 动态生成 -->
                </select>
            </div>
            <div class="form-group">
                <label>用户 UUID/密码</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="user-uuid" placeholder="留空自动生成" style="flex: 1;">
                    <button class="btn btn-primary" onclick="autoGenerateCredential()" style="min-width: 100px;">🎲 随机生成</button>
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    VLESS/VMess 使用 UUID，Trojan/Shadowsocks 使用密码
                </p>
            </div>
            <div class="form-group">
                <label>备注</label>
                <input type="text" id="user-email" placeholder="用户备注（可选）">
            </div>
            <button class="btn btn-primary" onclick="addUser()">➕ 添加用户</button>
            
            <div id="users-list"></div>
        </div>
        
        <div id="tab-subscription" class="content">
            <h2>📡 订阅管理</h2>
            <p style="margin-bottom: 20px; color: #666;">用户可以通过以下订阅链接获取所有协议的配置</p>
            
            <div id="subscription-list"></div>
        </div>
    </div>
    
    <script>
        const ADMIN_PASS = "{{ADMIN_PASSWORD}}";
        const WORKER_HOSTNAME = "{{WORKER_HOST}}";
        const PROTOCOLS = ENABLED_PROTOCOLS;
        
        // 切换标签页
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(\`tab-\${tab}\`).classList.add('active');
            
            if (tab === 'dashboard') loadDashboard();
            if (tab === 'users') loadUsers();
            if (tab === 'subscription') loadSubscriptions();
        }
        
        // 加载仪表盘
        async function loadDashboard() {
            const response = await fetch('/admin/api/users');
            const users = await response.json();
            
            // 按协议分组统计
            const stats = {};
            PROTOCOLS.forEach(p => stats[p] = 0);
            users.forEach(u => {
                if (u.protocol && stats[u.protocol] !== undefined) {
                    stats[u.protocol]++;
                }
            });
            
            const html = \`
                <div class="stat-card">
                    <h3>\${users.length}</h3>
                    <p>总用户数</p>
                </div>
                \${PROTOCOLS.map(p => \`
                    <div class="stat-card">
                        <h3>\${stats[p] || 0}</h3>
                        <p>\${p.toUpperCase()} 用户</p>
                    </div>
                \`).join('')}
            \`;
            document.getElementById('stats-cards').innerHTML = html;
            
            // 显示启用的协议
            const protocolInfo = \`
                <h3 style="margin-top: 30px;">启用的协议</h3>
                <div style="margin-top: 15px;">
                    \${PROTOCOLS.map(p => \`<span class="protocol-badge badge-\${p}">\${p.toUpperCase()}</span>\`).join('')}
                </div>
            \`;
            document.getElementById('protocol-info').innerHTML = protocolInfo;
        }
        
        // 加载用户列表
        async function loadUsers() {
            const response = await fetch('/admin/api/users');
            const users = await response.json();
            const html = \`
                <table>
                    <thead>
                        <tr>
                            <th>协议</th>
                            <th>UUID/ID</th>
                            <th>备注</th>
                            <th>流量</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${users.map(u => \`
                            <tr>
                                <td><span class="protocol-badge badge-\${u.protocol || 'vless'}">\${(u.protocol || 'vless').toUpperCase()}</span></td>
                                <td style="font-family: monospace; font-size: 12px;">\${u.uuid || u.id}</td>
                                <td>\${u.email || '-'}</td>
                                <td>\${formatBytes(u.traffic || 0)}</td>
                                <td>
                                    <button class="btn btn-danger" onclick="deleteUser('\${u.uuid || u.id}', '\${u.protocol || 'vless'}')">删除</button>
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('users-list').innerHTML = html;
        }
        
        // 加载订阅列表
        async function loadSubscriptions() {
            const response = await fetch('/admin/api/users');
            const users = await response.json();
            const html = users.map(u => \`
                <div class="subscription-box">
                    <span class="protocol-badge badge-\${u.protocol || 'vless'}">\${(u.protocol || 'vless').toUpperCase()}</span>
                    <input type="text" id="sub-\${u.uuid || u.id}" readonly value="https://\${WORKER_HOSTNAME}/sub?uuid=\${u.uuid || u.id}&protocol=\${u.protocol || 'vless'}">
                    <button class="btn btn-primary" onclick="copyUrl('sub-\${u.uuid || u.id}')">复制</button>
                </div>
            \`).join('');
            document.getElementById('subscription-list').innerHTML = html || '<p style="color: #999;">暂无用户</p>';
        }
        
        // 添加用户
        async function addUser() {
            const protocol = document.getElementById('user-protocol').value;
            const uuid = document.getElementById('user-uuid').value || generateCredential(protocol);
            const email = document.getElementById('user-email').value;
            
            const response = await fetch('/admin/api/users', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({protocol, uuid, email})
            });
            
            if (response.ok) {
                alert('用户添加成功！');
                document.getElementById('user-uuid').value = '';
                document.getElementById('user-email').value = '';
                loadUsers();
            }
        }
        
        // 删除用户
        async function deleteUser(uuid, protocol) {
            if (!confirm('确定要删除此用户吗？')) return;
            
            const response = await fetch(\`/admin/api/users/\${uuid}?protocol=\${protocol}\`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('用户删除成功！');
                loadUsers();
            }
        }
        
        // 复制订阅链接
        function copyUrl(id) {
            const input = document.getElementById(id);
            input.select();
            document.execCommand('copy');
            alert('订阅链接已复制！');
        }
        
        // 生成 UUID（用于 VLESS、VMess）
        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        
        // 生成随机密码（用于 Trojan、Shadowsocks）
        function generatePassword(length = 32) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            let password = '';
            for (let i = 0; i < length; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        }
        
        // 根据协议生成合适的 ID/密码
        function generateCredential(protocol) {
            switch (protocol) {
                case 'vless':
                case 'vmess':
                    return generateUUID();
                case 'trojan':
                case 'shadowsocks':
                    return generatePassword();
                default:
                    return generateUUID();
            }
        }
        
        // 自动生成凭证（按钮触发）
        function autoGenerateCredential() {
            const protocol = document.getElementById('user-protocol').value;
            const credential = generateCredential(protocol);
            document.getElementById('user-uuid').value = credential;
        }
        
        // 格式化字节
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // 初始化协议选择器
        function initProtocolSelector() {
            const select = document.getElementById('user-protocol');
            select.innerHTML = PROTOCOLS.map(p => 
                '<option value="' + p + '">' + p.toUpperCase() + '</option>'
            ).join('');
        }
        
        // 初始化
        initProtocolSelector();
        loadDashboard();
    </script>
</body>
</html>
`;

// ES Module 导出（Cloudflare Workers 新格式）
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    }
};

async function handleRequest(request, env, ctx) {
    // 设置全局 KV 绑定（兼容旧代码）
    if (!globalThis.PROXY_USERS && env.PROXY_USERS) {
        globalThis.PROXY_USERS = env.PROXY_USERS;
    }
    const url = new URL(request.url);
    
    // 管理面板
    if (url.pathname === '/admin') {
        return handleAdminPanel(request);
    }
    
    // 管理面板 API
    if (url.pathname.startsWith('/admin/api/')) {
        return handleAdminAPI(request, url);
    }
    
    // 订阅接口
    if (url.pathname === '/sub') {
        return handleSubscription(request, url);
    }
    
    // 代理请求（根据协议分发）
    return handleProxy(request, url);
}

// 处理管理面板
async function handleAdminPanel(request) {
    // 简单的 HTTP Basic Auth
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Basic ')) {
        return new Response('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Admin Panel"',
            },
        });
    }
    
    const credentials = atob(auth.substring(6)).split(':');
    if (credentials[1] !== ADMIN_PASSWORD) {
        return new Response('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Admin Panel"',
            },
        });
    }
    
    // 返回管理面板 HTML
    return new Response(ADMIN_PANEL_HTML, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}

// 处理管理面板 API
async function handleAdminAPI(request, url) {
    const path = url.pathname;
    
    // 用户列表
    if (path === '/admin/api/users' && request.method === 'GET') {
        const users = await getAllUsers();
        return new Response(JSON.stringify(users), {
            headers: {'Content-Type': 'application/json'},
        });
    }
    
    // 添加用户
    if (path === '/admin/api/users' && request.method === 'POST') {
        const data = await request.json();
        await addUser(data.protocol || 'vless', data.uuid, data.email || '');
        return new Response(JSON.stringify({success: true}), {
            headers: {'Content-Type': 'application/json'},
        });
    }
    
    // 删除用户
    if (path.startsWith('/admin/api/users/') && request.method === 'DELETE') {
        const uuid = path.split('/').pop();
        const protocol = url.searchParams.get('protocol') || 'vless';
        await deleteUser(protocol, uuid);
        return new Response(JSON.stringify({success: true}), {
            headers: {'Content-Type': 'application/json'},
        });
    }
    
    return new Response('Not Found', {status: 404});
}

// 处理订阅
async function handleSubscription(request, url) {
    const uuid = url.searchParams.get('uuid');
    const protocol = url.searchParams.get('protocol');
    
    if (!uuid) {
        return new Response('Missing uuid parameter', {status: 400});
    }
    
    // 获取所有用户
    const users = await getAllUsers();
    
    // 过滤用户
    let targetUsers = users;
    if (uuid) {
        targetUsers = users.filter(u => (u.uuid || u.id) === uuid);
    }
    if (protocol) {
        targetUsers = targetUsers.filter(u => (u.protocol || 'vless') === protocol);
    }
    
    // 生成订阅内容
    const configs = targetUsers.map(user => {
        const userProtocol = user.protocol || 'vless';
        const userId = user.uuid || user.id;
        const remark = encodeURIComponent(user.email || userId);
        
        // 根据协议生成不同的链接
        switch (userProtocol) {
            case 'vless':
                return `vless://${userId}@${WORKER_HOST}:443?encryption=none&type=ws&host=${WORKER_HOST}&path=/&sni=${WORKER_HOST}#${remark}`;
            case 'vmess':
                const vmessConfig = {
                    v: '2',
                    ps: user.email || userId,
                    add: WORKER_HOST,
                    port: '443',
                    id: userId,
                    aid: '0',
                    net: 'ws',
                    type: 'none',
                    host: WORKER_HOST,
                    path: '/',
                    tls: 'tls',
                    sni: WORKER_HOST
                };
                return 'vmess://' + btoa(JSON.stringify(vmessConfig));
            case 'trojan':
                return `trojan://${userId}@${WORKER_HOST}:443?sni=${WORKER_HOST}&type=ws&host=${WORKER_HOST}&path=/#${remark}`;
            case 'shadowsocks':
                const method = 'aes-256-gcm';
                const ssConfig = btoa(`${method}:${userId}`);
                return `ss://${ssConfig}@${WORKER_HOST}:443#${remark}`;
            default:
                return '';
        }
    }).filter(c => c);
    
    // Base64 编码
    const subscriptionContent = configs.join('\n');
    const base64Content = btoa(unescape(encodeURIComponent(subscriptionContent)));
    
    return new Response(base64Content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': 'attachment; filename="subscription.txt"'
        },
    });
}

// 处理代理请求
async function handleProxy(request, url) {
    // 这里需要根据请求头判断协议类型
    // 简化实现：从路径或 header 中获取协议信息
    const protocol = url.searchParams.get('protocol') || 'vless';
    
    if (!ENABLED_PROTOCOLS.includes(protocol)) {
        return new Response('Protocol not enabled', {status: 400});
    }
    
    // 根据协议调用不同的处理函数
    switch (protocol) {
        case 'vless':
            return handleVLESS(request);
        case 'vmess':
            return handleVMess(request);
        case 'trojan':
            return handleTrojan(request);
        case 'shadowsocks':
            return handleShadowsocks(request);
        default:
            return new Response('Unknown protocol', {status: 400});
    }
}

// VLESS 协议处理（简化版）
async function handleVLESS(request) {
    // TODO: 实现 VLESS 协议处理
    return new Response('VLESS proxy not implemented yet', {status: 501});
}

// VMess 协议处理（简化版）
async function handleVMess(request) {
    // TODO: 实现 VMess 协议处理
    return new Response('VMess proxy not implemented yet', {status: 501});
}

// Trojan 协议处理（简化版）
async function handleTrojan(request) {
    // TODO: 实现 Trojan 协议处理
    return new Response('Trojan proxy not implemented yet', {status: 501});
}

// Shadowsocks 协议处理（简化版）
async function handleShadowsocks(request) {
    // TODO: 实现 Shadowsocks 协议处理
    return new Response('Shadowsocks proxy not implemented yet', {status: 501});
}

// KV 操作函数
async function getAllUsers() {
    try {
        const listResult = await globalThis.PROXY_USERS.list();
        const users = [];
        
        // listResult.keys 是一个数组，每个元素是 {name: string, ...}
        if (listResult && listResult.keys) {
            for (const keyObj of listResult.keys) {
                if (keyObj.name && keyObj.name.startsWith('user:')) {
                    const userData = await globalThis.PROXY_USERS.get(keyObj.name, 'json');
                    if (userData) {
                        users.push(userData);
                    }
                }
            }
        }
        
        return users;
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
}

async function addUser(protocol, uuid, email) {
    try {
        const key = `user:${protocol}:${uuid}`;
        const userData = {
            protocol,
            uuid,
            id: uuid,
            email,
            traffic: 0,
            createdAt: new Date().toISOString()
        };
        await globalThis.PROXY_USERS.put(key, JSON.stringify(userData));
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

async function deleteUser(protocol, uuid) {
    try {
        const key = `user:${protocol}:${uuid}`;
        await globalThis.PROXY_USERS.delete(key);
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

async function getUser(protocol, uuid) {
    try {
        const key = `user:${protocol}:${uuid}`;
        const userData = await globalThis.PROXY_USERS.get(key, 'json');
        return userData;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

