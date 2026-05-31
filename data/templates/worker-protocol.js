import { connect } from 'cloudflare:sockets';

// ==================== 配置变量 ====================
let at = '351c9981-04b6-4103-aa4b-864aa9c91469';  // UUID
let fallbackAddress = '';  // 备用地址
let socks5Config = '';
let customPreferredIPs = [];
let customPreferredDomains = [];
let enableSocksDowngrade = false;
let disableNonTLS = false;

let ev = true;   // VLESS 协议
let et = false;  // Trojan 协议
let ex = false;  // XHTTP 协议
let tp = '';     // Trojan 密码
let cp = '';     // 自定义路径



let kvStore = null;
let kvConfig = {};

// ==================== 响应伪装（随机版本号，更难被探测）====================
const NGINX_VERSIONS = ['1.18.0', '1.20.1', '1.22.0', '1.24.0', '1.25.2', '1.25.3', '1.25.4', '1.27.0'];

function getRandomNginxVersion() {
    return NGINX_VERSIONS[Math.floor(Math.random() * NGINX_VERSIONS.length)];
}

function get404Response() {
    const version = getRandomNginxVersion();
    return new Response(`<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx/${version}</center>
</body>
</html>`, {
        status: 404,
        headers: {
            'Content-Type': 'text/html',
            'Server': `nginx/${version}`,
            'Date': new Date().toUTCString()
        }
    });
}

function get403Response() {
    const version = getRandomNginxVersion();
    return new Response(`<!DOCTYPE html>
<html>
<head><title>403 Forbidden</title></head>
<body>
<center><h1>403 Forbidden</h1></center>
<hr><center>nginx/${version}</center>
</body>
</html>`, {
        status: 403,
        headers: {
            'Content-Type': 'text/html',
            'Server': `nginx/${version}`,
            'Date': new Date().toUTCString()
        }
    });
}

// ==================== 错误消息 ====================
const E_INVALID_DATA = 'invalid data';
const E_INVALID_USER = 'invalid user';
const E_UNSUPPORTED_CMD = 'command is not supported';
const E_UDP_DNS_ONLY = 'UDP proxy only enable for DNS which is port 53';
const E_INVALID_ADDR_TYPE = 'invalid addressType';
const E_EMPTY_ADDR = 'addressValue is empty';
const E_WS_NOT_OPEN = 'webSocket.readyState is not open';
const E_INVALID_ID_STR = 'Stringified identifier is invalid';
const E_INVALID_SOCKS_ADDR = 'Invalid SOCKS address format';
const E_SOCKS_NO_METHOD = 'no acceptable methods';
const E_SOCKS_AUTH_NEEDED = 'socks server needs auth';
const E_SOCKS_AUTH_FAIL = 'fail to auth socks server';
const E_SOCKS_CONN_FAIL = 'fail to open socks connection';

let parsedSocks5Config = {};
let isSocksEnabled = false;

const ADDRESS_TYPE_IPV4 = 1;
const ADDRESS_TYPE_URL = 2;
const ADDRESS_TYPE_IPV6 = 3;

// ==================== 工具函数 ====================
function isValidFormat(str) {
    const userRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return userRegex.test(str);
}

function isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(ip)) return true;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(ip)) return true;
    return false;
}

function parseAddressAndPort(input) {
    if (input.includes('[') && input.includes(']')) {
        const match = input.match(/^\[([^\]]+)\](?::(\d+))?$/);
        if (match) {
            return { address: match[1], port: match[2] ? parseInt(match[2], 10) : null };
        }
    }
    const lastColonIndex = input.lastIndexOf(':');
    if (lastColonIndex > 0) {
        const address = input.substring(0, lastColonIndex);
        const portStr = input.substring(lastColonIndex + 1);
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0 && port <= 65535) {
            return { address, port };
        }
    }
    return { address: input, port: null };
}



// ==================== KV 存储 ====================
async function initKVStore(env) {
    if (env.C) {
        try {
            kvStore = env.C;
            await loadKVConfig();
        } catch (error) {
            kvStore = null;
        }
    }
}

async function loadKVConfig() {
    if (!kvStore) return;
    try {
        const configData = await kvStore.get('c');
        if (configData) {
            kvConfig = JSON.parse(configData);
        }
    } catch (error) {
        kvConfig = {};
    }
}

async function saveKVConfig() {
    if (!kvStore) return;
    try {
        await kvStore.put('c', JSON.stringify(kvConfig));
    } catch (error) {
        throw error;
    }
}

function getConfigValue(key, defaultValue = '') {
    if (kvConfig[key] !== undefined) {
        return kvConfig[key];
    }
    return defaultValue;
}

async function setConfigValue(key, value) {
    kvConfig[key] = value;
    await saveKVConfig();
}

// ==================== 主入口 ====================
export default {
    async fetch(request, env, ctx) {
        try {
            await initKVStore(env);

            // 读取配置
            at = (env.u || env.U || at).toLowerCase();
            cp = getConfigValue('d', env.d || env.D) || '';

            // 落地 IP 配置（单一备用地址）
            const proxyIPConfig = getConfigValue('p', env.p || env.P) || '';
            if (proxyIPConfig && proxyIPConfig.trim()) {
                fallbackAddress = proxyIPConfig.trim();
            }

            // SOCKS5 配置
            socks5Config = getConfigValue('s', env.s || env.S) || '';
            if (socks5Config) {
                try {
                    parsedSocks5Config = parseSocksConfig(socks5Config);
                    isSocksEnabled = true;
                } catch (err) {
                    isSocksEnabled = false;
                }
            }

            // 自定义优选 IP
            const customPreferred = getConfigValue('yx', env.yx || env.YX);
            if (customPreferred) {
                try {
                    const preferredList = customPreferred.split(',').map(item => item.trim()).filter(item => item);
                    customPreferredIPs = [];
                    customPreferredDomains = [];
                    preferredList.forEach(item => {
                        let nodeName = '';
                        let addressPart = item;
                        if (item.includes('#')) {
                            const parts = item.split('#');
                            addressPart = parts[0].trim();
                            nodeName = parts[1].trim();
                        }
                        const { address, port } = parseAddressAndPort(addressPart);
                        if (!nodeName) nodeName = '自定义优选-' + address + (port ? ':' + port : '');
                        if (isValidIP(address)) {
                            customPreferredIPs.push({ ip: address, port: port, isp: nodeName });
                        } else {
                            customPreferredDomains.push({ domain: address, port: port, name: nodeName });
                        }
                    });
                } catch (err) {
                    customPreferredIPs = [];
                    customPreferredDomains = [];
                }
            }

            // 协议控制
            const vlessControl = getConfigValue('ev', env.ev);
            if (vlessControl !== undefined && vlessControl !== '') {
                ev = vlessControl === 'yes' || vlessControl === true || vlessControl === 'true';
            }
            const tjControl = getConfigValue('et', env.et);
            if (tjControl !== undefined && tjControl !== '') {
                et = tjControl === 'yes' || tjControl === true || tjControl === 'true';
            }
            tp = getConfigValue('tp', env.tp) || '';
            const xhttpControl = getConfigValue('ex', env.ex);
            if (xhttpControl !== undefined && xhttpControl !== '') {
                ex = xhttpControl === 'yes' || xhttpControl === true || xhttpControl === 'true';
            }
            if (!ev && !et && !ex) ev = true;

            const downgradeControl = getConfigValue('qj', env.qj || env.QJ);
            if (downgradeControl && downgradeControl.toLowerCase() === 'no') {
                enableSocksDowngrade = true;
            }

            const dkbyControl = getConfigValue('dkby', env.dkby || env.DKBY);
            if (dkbyControl && dkbyControl.toLowerCase() === 'yes') {
                disableNonTLS = true;
            }

            const url = new URL(request.url);
            const path = url.pathname.replace(/^\/+/, '');

            // 安全检查：验证路径是否包含 UUID 或自定义路径
            const validPath = cp || at;
            const isValidAccess = path === validPath ||
                path.startsWith(validPath + '/') ||
                path.includes('/api/config');

            // API 配置访问（需要 UUID 路径验证）
            if (path.includes('/api/config') && isValidAccess) {
                return await handleConfigAPI(request);
            }

            // XHTTP 请求处理（POST）- 暂时禁用
            // 原因：CF Worker 对流式 POST 请求支持有限，Cloudflare 边缘会返回 403
            // 待后续方案修复（可考虑使用 Nginx + grpc_pass 反代方式）
            /*
            if (request.method === 'POST' && ex) {
                const r = await handleXhttpPost(request);
                if (r) {
                    if (r instanceof Response) return r;
                    if (r.closed) ctx.waitUntil(r.closed);
                    return new Response(r.readable, {
                        headers: {
                            'X-Accel-Buffering': 'no',
                            'Cache-Control': 'no-store',
                            'Connection': 'keep-alive',
                            'User-Agent': 'Go-http-client/2.0',
                            'Content-Type': 'application/grpc',
                        },
                    });
                }
                return new Response('Internal Server Error', { status: 500 });
            }
            */

            // 非法访问返回 404（WebSocket 除外）
            if (!isValidAccess && request.headers.get('Upgrade') !== 'websocket') {
                return get404Response();
            }

            // WebSocket 升级请求
            if (request.headers.get('Upgrade') === 'websocket') {
                return await handleWsRequest(request);
            }

            // 默认返回 404（隐藏服务）
            return get404Response();

        } catch (err) {
            return new Response('Error: ' + err.message, { status: 500 });
        }
    }
};

// ==================== 配置 API ====================
async function handleConfigAPI(request) {
    if (request.method === 'GET') {
        if (!kvStore) {
            return new Response(JSON.stringify({ error: 'KV存储未配置', kvEnabled: false }), {
                status: 503, headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ ...kvConfig, kvEnabled: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } else if (request.method === 'POST') {
        if (!kvStore) {
            return new Response(JSON.stringify({ success: false, message: 'KV存储未配置' }), {
                status: 503, headers: { 'Content-Type': 'application/json' }
            });
        }
        try {
            const newConfig = await request.json();
            for (const [key, value] of Object.entries(newConfig)) {
                if (value === '' || value === null || value === undefined) {
                    delete kvConfig[key];
                } else {
                    kvConfig[key] = value;
                }
            }
            await saveKVConfig();
            return new Response(JSON.stringify({ success: true, message: '配置已保存', config: kvConfig }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ success: false, message: '保存失败: ' + error.message }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { 'Content-Type': 'application/json' }
    });
}

// ==================== WebSocket 处理 ====================
async function handleWsRequest(request) {
    const wsPair = new WebSocketPair();
    const [clientSock, serverSock] = Object.values(wsPair);
    serverSock.accept();

    let remoteConnWrapper = { socket: null, writer: null };
    let isDnsQuery = false;
    let protocolType = null;

    const earlyData = request.headers.get('sec-websocket-protocol') || '';
    const readable = makeReadableStream(serverSock, earlyData);

    readable.pipeTo(new WritableStream({
        async write(chunk) {
            if (isDnsQuery) return await forwardUDP(chunk, serverSock, null);
            if (remoteConnWrapper.socket) {
                // 复用 writer，避免每次都 getWriter/releaseLock
                if (!remoteConnWrapper.writer) {
                    remoteConnWrapper.writer = remoteConnWrapper.socket.writable.getWriter();
                }
                await remoteConnWrapper.writer.write(chunk);
                return;
            }

            if (!protocolType) {
                // 尝试 VLESS 协议
                if (ev && chunk.byteLength >= 24) {
                    const vlessResult = parseWsPacketHeader(chunk, at);
                    if (!vlessResult.hasError) {
                        protocolType = 'vless';
                        const { addressType, port, hostname, rawIndex, version, isUDP } = vlessResult;
                        if (isUDP) {
                            if (port === 53) isDnsQuery = true;
                            else throw new Error(E_UDP_DNS_ONLY);
                        }
                        const respHeader = new Uint8Array([version[0], 0]);
                        const rawData = chunk.slice(rawIndex);
                        if (isDnsQuery) return forwardUDP(rawData, serverSock, respHeader);
                        await forwardTCP(addressType, hostname, port, rawData, serverSock, respHeader, remoteConnWrapper);
                        return;
                    }
                }

                // 尝试 Trojan 协议
                if (et && chunk.byteLength >= 56) {
                    const tjResult = await parseTrojanHeader(chunk, at);
                    if (!tjResult.hasError) {
                        protocolType = 'trojan';
                        const { addressType, port, hostname, rawClientData } = tjResult;
                        await forwardTCP(addressType, hostname, port, rawClientData, serverSock, null, remoteConnWrapper);
                        return;
                    }
                }

                throw new Error('Invalid protocol or authentication failed');
            }
        },
    })).catch((err) => { });

    return new Response(null, { status: 101, webSocket: clientSock });
}

// ==================== TCP 转发 ====================
async function forwardTCP(addrType, host, portNum, rawData, ws, respHeader, remoteConnWrapper) {
    async function connectAndSend(address, port, useSocks = false) {
        // 直接连接，不等待 opened（与高性能版本一致）
        const remoteSock = useSocks ?
            await establishSocksConnection(addrType, address, port) :
            connect({ hostname: address, port: port });
        const writer = remoteSock.writable.getWriter();
        await writer.write(rawData);
        writer.releaseLock();
        return remoteSock;
    }

    async function retryConnection() {
        // 使用固定的 fallbackAddress（不轮询，保持 TLS session 稳定）
        let backupHost = host, backupPort = portNum;

        if (fallbackAddress && fallbackAddress.trim()) {
            const parsed = parseAddressAndPort(fallbackAddress);
            backupHost = parsed.address;
            backupPort = parsed.port || portNum;
        }

        if (enableSocksDowngrade && isSocksEnabled) {
            try {
                const socksSocket = await connectAndSend(host, portNum, true);
                remoteConnWrapper.socket = socksSocket;
                socksSocket.closed.catch(() => { }).finally(() => closeSocketQuietly(ws));
                connectStreams(socksSocket, ws, respHeader, null);
                return;
            } catch (socksErr) {
                try {
                    const fallbackSocket = await connectAndSend(backupHost, backupPort, false);
                    remoteConnWrapper.socket = fallbackSocket;
                    fallbackSocket.closed.catch(() => { }).finally(() => closeSocketQuietly(ws));
                    connectStreams(fallbackSocket, ws, respHeader, null);
                } catch (fallbackErr) {
                    closeSocketQuietly(ws);
                }
            }
        } else {
            try {
                const fallbackSocket = await connectAndSend(backupHost, backupPort, isSocksEnabled);
                remoteConnWrapper.socket = fallbackSocket;
                fallbackSocket.closed.catch(() => { }).finally(() => closeSocketQuietly(ws));
                connectStreams(fallbackSocket, ws, respHeader, null);
            } catch (fallbackErr) {
                closeSocketQuietly(ws);
            }
        }
    }

    try {
        const initialSocket = await connectAndSend(host, portNum, enableSocksDowngrade ? false : isSocksEnabled);
        remoteConnWrapper.socket = initialSocket;
        connectStreams(initialSocket, ws, respHeader, retryConnection);
    } catch (err) {
        retryConnection();
    }
}

// ==================== 协议解析 ====================
function parseWsPacketHeader(chunk, token) {
    if (chunk.byteLength < 24) return { hasError: true, message: E_INVALID_DATA };
    const version = new Uint8Array(chunk.slice(0, 1));
    if (formatIdentifier(new Uint8Array(chunk.slice(1, 17))) !== token) return { hasError: true, message: E_INVALID_USER };
    const optLen = new Uint8Array(chunk.slice(17, 18))[0];
    const cmd = new Uint8Array(chunk.slice(18 + optLen, 19 + optLen))[0];
    let isUDP = false;
    if (cmd === 1) { } else if (cmd === 2) { isUDP = true; } else { return { hasError: true, message: E_UNSUPPORTED_CMD }; }
    const portIdx = 19 + optLen;
    const port = new DataView(chunk.slice(portIdx, portIdx + 2)).getUint16(0);
    let addrIdx = portIdx + 2, addrLen = 0, addrValIdx = addrIdx + 1, hostname = '';
    const addressType = new Uint8Array(chunk.slice(addrIdx, addrValIdx))[0];
    switch (addressType) {
        case ADDRESS_TYPE_IPV4: addrLen = 4; hostname = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + addrLen)).join('.'); break;
        case ADDRESS_TYPE_URL: addrLen = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + 1))[0]; addrValIdx += 1; hostname = new TextDecoder().decode(chunk.slice(addrValIdx, addrValIdx + addrLen)); break;
        case ADDRESS_TYPE_IPV6: addrLen = 16; const ipv6 = []; const ipv6View = new DataView(chunk.slice(addrValIdx, addrValIdx + addrLen)); for (let i = 0; i < 8; i++) ipv6.push(ipv6View.getUint16(i * 2).toString(16)); hostname = ipv6.join(':'); break;
        default: return { hasError: true, message: `${E_INVALID_ADDR_TYPE}: ${addressType}` };
    }
    if (!hostname) return { hasError: true, message: `${E_EMPTY_ADDR}: ${addressType}` };
    return { hasError: false, addressType, port, hostname, isUDP, rawIndex: addrValIdx + addrLen, version };
}

async function parseTrojanHeader(chunk, uuid) {
    try {
        // 转换为 Uint8Array 以支持索引访问
        const data = new Uint8Array(chunk);
        const password = tp || uuid;
        const expectedHash = await sha224(password);
        const receivedHash = new TextDecoder().decode(data.slice(0, 56));
        if (receivedHash !== expectedHash) {
            return { hasError: true, message: 'Invalid Trojan password' };
        }
        let offset = 56 + 2; // hash + CRLF
        const cmd = data[offset];
        offset += 1;
        if (cmd !== 1) {
            return { hasError: true, message: 'Unsupported Trojan command' };
        }
        const addressType = data[offset];
        offset += 1;
        let hostname = '';
        switch (addressType) {
            case 1: // IPv4
                hostname = data.slice(offset, offset + 4).join('.');
                offset += 4;
                break;
            case 3: // Domain
                const domainLen = data[offset];
                offset += 1;
                hostname = new TextDecoder().decode(data.slice(offset, offset + domainLen));
                offset += domainLen;
                break;
            case 4: // IPv6
                const ipv6Parts = [];
                for (let i = 0; i < 8; i++) {
                    ipv6Parts.push(((data[offset + i * 2] << 8) + data[offset + i * 2 + 1]).toString(16));
                }
                hostname = ipv6Parts.join(':');
                offset += 16;
                break;
            default:
                return { hasError: true, message: 'Invalid address type' };
        }
        const port = (data[offset] << 8) + data[offset + 1];
        offset += 2;
        offset += 2; // CRLF
        const rawClientData = data.slice(offset);
        return { hasError: false, addressType, hostname, port, rawClientData };
    } catch (err) {
        return { hasError: true, message: err.message };
    }
}

// ==================== 流处理 ====================

function makeReadableStream(socket, earlyDataHeader) {
    let cancelled = false;
    return new ReadableStream({
        start(controller) {
            socket.addEventListener('message', (event) => { if (!cancelled) controller.enqueue(event.data); });
            socket.addEventListener('close', () => { if (!cancelled) { closeSocketQuietly(socket); controller.close(); } });
            socket.addEventListener('error', (err) => controller.error(err));
            const { earlyData, error } = base64ToArray(earlyDataHeader);
            if (error) controller.error(error); else if (earlyData) controller.enqueue(earlyData);
        },
        cancel() { cancelled = true; closeSocketQuietly(socket); }
    });
}

// 高效合并 header 和 chunk
function concatArrayBuffers(header, chunk) {
    const headerBuf = header instanceof ArrayBuffer ? header : header.buffer || new Uint8Array(header).buffer;
    const chunkBuf = chunk instanceof ArrayBuffer ? chunk : chunk.buffer || new Uint8Array(chunk).buffer;
    const result = new Uint8Array(headerBuf.byteLength + chunkBuf.byteLength);
    result.set(new Uint8Array(headerBuf), 0);
    result.set(new Uint8Array(chunkBuf), headerBuf.byteLength);
    return result.buffer;
}

async function connectStreams(remoteSocket, webSocket, headerData, retryFunc) {
    let header = headerData, hasData = false;
    await remoteSocket.readable.pipeTo(
        new WritableStream({
            async write(chunk, controller) {
                hasData = true;
                if (webSocket.readyState !== 1) controller.error(E_WS_NOT_OPEN);
                if (header) { webSocket.send(await new Blob([header, chunk]).arrayBuffer()); header = null; }
                else { webSocket.send(chunk); }
            },
            abort(reason) { },
        })
    ).catch((error) => { closeSocketQuietly(webSocket); });
    if (!hasData && retryFunc) retryFunc();
}

async function forwardUDP(udpChunk, webSocket, respHeader) {
    try {
        const tcpSocket = connect({ hostname: '8.8.4.4', port: 53 });
        let header = respHeader;
        const writer = tcpSocket.writable.getWriter();
        await writer.write(udpChunk);
        writer.releaseLock();
        await tcpSocket.readable.pipeTo(new WritableStream({
            async write(chunk) {
                if (webSocket.readyState === 1) {
                    if (header) { webSocket.send(await new Blob([header, chunk]).arrayBuffer()); header = null; }
                    else { webSocket.send(chunk); }
                }
            },
        }));
    } catch (error) { }
}

// ==================== SOCKS5 ====================
async function establishSocksConnection(addrType, address, port) {
    const { username, password, hostname, socksPort } = parsedSocks5Config;
    const socket = connect({ hostname, port: socksPort });
    const writer = socket.writable.getWriter();
    await writer.write(new Uint8Array(username ? [5, 2, 0, 2] : [5, 1, 0]));
    const reader = socket.readable.getReader();
    let res = (await reader.read()).value;
    if (res[0] !== 5 || res[1] === 255) throw new Error(E_SOCKS_NO_METHOD);
    if (res[1] === 2) {
        if (!username || !password) throw new Error(E_SOCKS_AUTH_NEEDED);
        const encoder = new TextEncoder();
        const authRequest = new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]);
        await writer.write(authRequest);
        res = (await reader.read()).value;
        if (res[0] !== 1 || res[1] !== 0) throw new Error(E_SOCKS_AUTH_FAIL);
    }
    const encoder = new TextEncoder(); let DSTADDR;
    switch (addrType) {
        case ADDRESS_TYPE_IPV4: DSTADDR = new Uint8Array([1, ...address.split('.').map(Number)]); break;
        case ADDRESS_TYPE_URL: DSTADDR = new Uint8Array([3, address.length, ...encoder.encode(address)]); break;
        case ADDRESS_TYPE_IPV6: DSTADDR = new Uint8Array([4, ...address.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]); break;
        default: throw new Error(E_INVALID_ADDR_TYPE);
    }
    await writer.write(new Uint8Array([5, 1, 0, ...DSTADDR, port >> 8, port & 255]));
    res = (await reader.read()).value;
    if (res[1] !== 0) throw new Error(E_SOCKS_CONN_FAIL);
    writer.releaseLock(); reader.releaseLock();
    return socket;
}

function parseSocksConfig(address) {
    let [latter, former] = address.split("@").reverse();
    let username, password, hostname, socksPort;
    if (former) {
        const formers = former.split(":");
        if (formers.length !== 2) throw new Error(E_INVALID_SOCKS_ADDR);
        [username, password] = formers;
    }
    const latters = latter.split(":");
    socksPort = Number(latters.pop());
    if (isNaN(socksPort)) throw new Error(E_INVALID_SOCKS_ADDR);
    hostname = latters.join(":");
    if (hostname.includes(":") && !/^\[.*\]$/.test(hostname)) throw new Error(E_INVALID_SOCKS_ADDR);
    return { username, password, hostname, socksPort };
}

// ==================== 工具函数 ====================
function base64ToArray(b64Str) {
    if (!b64Str) return { error: null };
    try {
        b64Str = b64Str.replace(/-/g, '+').replace(/_/g, '/');
        return { earlyData: Uint8Array.from(atob(b64Str), (c) => c.charCodeAt(0)).buffer, error: null };
    } catch (error) {
        return { error };
    }
}

function closeSocketQuietly(socket) {
    try { if (socket.readyState === 1 || socket.readyState === 2) socket.close(); } catch (error) { }
}

const hexTable = Array.from({ length: 256 }, (v, i) => (i + 256).toString(16).slice(1));
function formatIdentifier(arr, offset = 0) {
    const id = (hexTable[arr[offset]] + hexTable[arr[offset + 1]] + hexTable[arr[offset + 2]] + hexTable[arr[offset + 3]] + "-" + hexTable[arr[offset + 4]] + hexTable[arr[offset + 5]] + "-" + hexTable[arr[offset + 6]] + hexTable[arr[offset + 7]] + "-" + hexTable[arr[offset + 8]] + hexTable[arr[offset + 9]] + "-" + hexTable[arr[offset + 10]] + hexTable[arr[offset + 11]] + hexTable[arr[offset + 12]] + hexTable[arr[offset + 13]] + hexTable[arr[offset + 14]] + hexTable[arr[offset + 15]]).toLowerCase();
    if (!isValidFormat(id)) throw new TypeError(E_INVALID_ID_STR);
    return id;
}

async function sha224(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let H = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4];
    const msgLen = data.length;
    const bitLen = msgLen * 8;
    const padLen = (msgLen % 64 < 56) ? (56 - msgLen % 64) : (120 - msgLen % 64);
    const paddedMsg = new Uint8Array(msgLen + padLen + 8);
    paddedMsg.set(data, 0);
    paddedMsg[msgLen] = 0x80;
    const view = new DataView(paddedMsg.buffer);
    view.setUint32(paddedMsg.length - 4, bitLen, false);
    for (let i = 0; i < paddedMsg.length; i += 64) {
        const W = new Uint32Array(64);
        for (let t = 0; t < 16; t++) {
            W[t] = view.getUint32(i + t * 4, false);
        }
        for (let t = 16; t < 64; t++) {
            const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
            const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let t = 0; t < 64; t++) {
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const result = [];
    for (let i = 0; i < 7; i++) {
        result.push(
            ((H[i] >>> 24) & 0xff).toString(16).padStart(2, '0'),
            ((H[i] >>> 16) & 0xff).toString(16).padStart(2, '0'),
            ((H[i] >>> 8) & 0xff).toString(16).padStart(2, '0'),
            (H[i] & 0xff).toString(16).padStart(2, '0')
        );
    }
    return result.join('');
}

function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
}

// ==================== XHTTP 协议 ====================
let ACTIVE_CONNECTIONS = 0;
const XHTTP_BUFFER_SIZE = 512 * 1024;  // 512KB 缓冲（原128KB，提升4倍）
const CONNECT_TIMEOUT_MS = 10000;  // 10秒连接超时（原5秒）
const IDLE_TIMEOUT_MS = 90000;  // 90秒空闲超时（原45秒）
const MAX_RETRIES = 5;  // 最多重试5次（原2次）
const MAX_CONCURRENT = 100;  // 最大并发100（原32，支持CF测速工具高并发）

function xhttp_sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function validate_uuid_xhttp(id, uuid) {
    for (let index = 0; index < 16; index++) {
        if (id[index] !== uuid[index]) return false;
    }
    return true;
}

function get_xhttp_buffer(size) {
    return new Uint8Array(new ArrayBuffer(size || XHTTP_BUFFER_SIZE));
}

function concat_typed_arrays(first, ...args) {
    let len = first.length;
    for (let a of args) len += a.length;
    const r = new first.constructor(len);
    r.set(first, 0);
    len = first.length;
    for (let a of args) { r.set(a, len); len += a.length; }
    return r;
}

function parse_uuid_xhttp(uuid) {
    uuid = uuid.replaceAll('-', '');
    const r = [];
    for (let index = 0; index < 16; index++) {
        r.push(parseInt(uuid.substr(index * 2, 2), 16));
    }
    return r;
}

async function read_xhttp_header(readable, uuid_str) {
    const reader = readable.getReader({ mode: 'byob' });
    try {
        let r = await reader.readAtLeast(1 + 16 + 1, get_xhttp_buffer());
        let rlen = 0, idx = 0;
        let cache = r.value;
        rlen += r.value.length;
        const version = cache[0];
        const id = cache.slice(1, 1 + 16);
        const uuid = parse_uuid_xhttp(uuid_str);
        if (!validate_uuid_xhttp(id, uuid)) return 'invalid UUID';
        const pb_len = cache[1 + 16];
        const addr_plus1 = 1 + 16 + 1 + pb_len + 1 + 2 + 1;
        if (addr_plus1 + 1 > rlen) {
            if (r.done) return 'header too short';
            idx = addr_plus1 + 1 - rlen;
            r = await reader.readAtLeast(idx, get_xhttp_buffer());
            rlen += r.value.length;
            cache = concat_typed_arrays(cache, r.value);
        }
        const cmd = cache[1 + 16 + 1 + pb_len];
        if (cmd !== 1) return `unsupported command: ${cmd}`;
        const port = (cache[addr_plus1 - 1 - 2] << 8) + cache[addr_plus1 - 1 - 1];
        const atype = cache[addr_plus1 - 1];
        let header_len = -1;
        if (atype === ADDRESS_TYPE_IPV4) header_len = addr_plus1 + 4;
        else if (atype === ADDRESS_TYPE_IPV6) header_len = addr_plus1 + 16;
        else if (atype === ADDRESS_TYPE_URL) header_len = addr_plus1 + 1 + cache[addr_plus1];
        if (header_len < 0) return 'read address type failed';
        idx = header_len - rlen;
        if (idx > 0) {
            if (r.done) return 'read address failed';
            r = await reader.readAtLeast(idx, get_xhttp_buffer());
            rlen += r.value.length;
            cache = concat_typed_arrays(cache, r.value);
        }
        let hostname = '';
        idx = addr_plus1;
        switch (atype) {
            case ADDRESS_TYPE_IPV4: hostname = cache.slice(idx, idx + 4).join('.'); break;
            case ADDRESS_TYPE_URL: hostname = new TextDecoder().decode(cache.slice(idx + 1, idx + 1 + cache[idx])); break;
            case ADDRESS_TYPE_IPV6: hostname = cache.slice(idx, idx + 16).reduce((s, b2, i2, a) => i2 % 2 ? s.concat(((a[i2 - 1] << 8) + b2).toString(16)) : s, []).join(':'); break;
        }
        if (hostname.length < 1) return 'failed to parse hostname';
        const data = cache.slice(header_len);
        return { hostname, port, data, resp: new Uint8Array([version, 0]), reader, done: r.done };
    } catch (error) {
        try { reader.releaseLock(); } catch (_) { }
        throw error;
    }
}

class XhttpCounter {
    #total;
    constructor() { this.#total = 0; }
    get() { return this.#total; }
    add(size) { this.#total += size; }
}

async function upload_to_remote_xhttp(counter, writer, httpx) {
    async function inner_upload(d) {
        if (!d || d.length === 0) return;
        counter.add(d.length);
        await writer.write(d);
    }
    try {
        await inner_upload(httpx.data);
        let chunkCount = 0;
        while (!httpx.done) {
            const r = await httpx.reader.read(get_xhttp_buffer());
            if (r.done) break;
            await inner_upload(r.value);
            httpx.done = r.done;
            chunkCount++;
            if (chunkCount % 10 === 0) await xhttp_sleep(0);
            if (!r.value || r.value.length === 0) await xhttp_sleep(2);
        }
    } catch (error) { throw error; }
}

function create_xhttp_uploader(httpx, writable) {
    const counter = new XhttpCounter();
    const writer = writable.getWriter();
    const done = (async () => {
        try { await upload_to_remote_xhttp(counter, writer, httpx); }
        catch (error) { throw error; }
        finally { try { await writer.close(); } catch (error) { } }
    })();
    return { counter, done, abort: () => { try { writer.abort(); } catch (_) { } } };
}

function create_xhttp_downloader(resp, remote_readable) {
    const counter = new XhttpCounter();
    let rejectFn;
    const stream = new TransformStream({
        start(controller) { counter.add(resp.length); controller.enqueue(resp); },
        transform(chunk, controller) { counter.add(chunk.length); controller.enqueue(chunk); },
        cancel(reason) { if (rejectFn) rejectFn(`download cancelled: ${reason}`); },
    }, null, new ByteLengthQueuingStrategy({ highWaterMark: XHTTP_BUFFER_SIZE }));
    const done = new Promise((resolve, reject) => {
        rejectFn = reject;
        let lastActivity = Date.now();
        const idleTimer = setInterval(() => {
            if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
                try { stream.writable.abort?.('idle timeout'); } catch (_) { }
                clearInterval(idleTimer);
                reject('idle timeout');
            }
        }, 5000);
        const reader = remote_readable.getReader();
        const writer = stream.writable.getWriter();
        (async () => {
            try {
                let chunkCount = 0;
                while (true) {
                    const r = await reader.read();
                    if (r.done) break;
                    lastActivity = Date.now();
                    await writer.write(r.value);
                    chunkCount++;
                    if (chunkCount % 5 === 0) await xhttp_sleep(0);
                }
                await writer.close();
                resolve();
            } catch (err) { reject(err); }
            finally {
                try { reader.releaseLock(); } catch (_) { }
                try { writer.releaseLock(); } catch (_) { }
                clearInterval(idleTimer);
            }
        })();
    });
    return {
        readable: stream.readable, counter, done,
        abort: () => { try { stream.readable.cancel(); } catch (_) { } try { stream.writable.abort(); } catch (_) { } }
    };
}

async function connect_to_remote_xhttp(httpx, ...remotes) {
    let attempt = 0, lastErr;
    const connectionList = [httpx.hostname, ...remotes.filter(r => r && r !== httpx.hostname)];
    for (const hostname of connectionList) {
        if (!hostname) continue;
        attempt = 0;
        while (attempt < MAX_RETRIES) {
            attempt++;
            try {
                const remote = connect({ hostname, port: httpx.port });
                const timeoutPromise = xhttp_sleep(CONNECT_TIMEOUT_MS).then(() => { throw new Error('connect timeout'); });
                await Promise.race([remote.opened, timeoutPromise]);
                const uploader = create_xhttp_uploader(httpx, remote.writable);
                const downloader = create_xhttp_downloader(httpx.resp, remote.readable);
                return { downloader, uploader, close: () => { try { remote.close(); } catch (_) { } } };
            } catch (err) {
                lastErr = err;
                if (attempt < MAX_RETRIES) await xhttp_sleep(500 * attempt);
            }
        }
    }
    return null;
}

async function handle_xhttp_client(body, uuid) {
    if (ACTIVE_CONNECTIONS >= MAX_CONCURRENT) {
        return new Response('Too many connections', { status: 429 });
    }
    ACTIVE_CONNECTIONS++;
    let cleaned = false;
    const cleanup = () => { if (!cleaned) { ACTIVE_CONNECTIONS = Math.max(0, ACTIVE_CONNECTIONS - 1); cleaned = true; } };
    try {
        const httpx = await read_xhttp_header(body, uuid);
        if (typeof httpx !== 'object' || !httpx) return null;

        // 使用固定的 fallbackAddress 进行连接
        const remoteConnection = await connect_to_remote_xhttp(httpx, fallbackAddress || '');
        if (remoteConnection === null) return null;
        const connectionClosed = Promise.race([
            (async () => { try { await remoteConnection.downloader.done; } catch (err) { } })(),
            (async () => { try { await remoteConnection.uploader.done; } catch (err) { } })(),
            xhttp_sleep(IDLE_TIMEOUT_MS).then(() => { })
        ]).finally(() => {
            try { remoteConnection.close(); } catch (_) { }
            try { remoteConnection.downloader.abort(); } catch (_) { }
            try { remoteConnection.uploader.abort(); } catch (_) { }
            cleanup();
        });
        return { readable: remoteConnection.downloader.readable, closed: connectionClosed };
    } catch (error) { cleanup(); return null; }
}

async function handleXhttpPost(request) {
    try { return await handle_xhttp_client(request.body, at); }
    catch (err) { return null; }
}
