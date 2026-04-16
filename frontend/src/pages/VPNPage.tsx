import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Wifi,
  WifiOff,
  Download,
  Server,
  Copy,
  Check,
  Play,
  Square,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { vpnApi } from '@/api/vpn'

type VPNStatus = {
  connected: boolean
  server: string
  protocol: string
  local_ip: string
  remote_ip: string
  connect_time: string
  duration: string
  upload_bytes: number
  download_bytes: number
}

export default function VPNPage() {
  const { t } = useTranslation()
  const { themeStyle } = useThemeStore()
  
  const [status, setStatus] = useState<VPNStatus | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [cloudflareScript, setCloudflareScript] = useState('')
  const [copied, setCopied] = useState(false)

  // 连接配置
  const [server, setServer] = useState('')
  const [username, setUsername] = useState('vpn')
  const [password, setPassword] = useState('')
  const [protocol, setProtocol] = useState('sstp')

  // 获取VPN状态
  const fetchStatus = async () => {
    try {
      const data = await vpnApi.getStatus()
      setStatus(data.status)
    } catch (error) {
      console.error('获取VPN状态失败:', error)
    }
  }

  // 获取Cloudflare脚本
  const fetchCloudflareScript = async () => {
    try {
      const data = await vpnApi.getCloudflareScript()
      setCloudflareScript(data.script)
    } catch (error) {
      console.error('获取Cloudflare脚本失败:', error)
    }
  }

  // 连接VPN
  const connectVPN = async () => {
    if (!server) {
      toast.error(t('vpn.errors.serverRequired'))
      return
    }

    setIsConnecting(true)
    try {
      const result = await vpnApi.connect({
        server,
        username,
        password,
        protocol
      })
      
      if (result.success) {
        toast.success(t('vpn.connectionSuccess'))
        fetchStatus()
      } else {
        toast.error(result.message || t('vpn.errors.connectionFailed'))
      }
    } catch (error: any) {
      toast.error(error.message || t('vpn.errors.connectionFailed'))
    } finally {
      setIsConnecting(false)
    }
  }

  // 断开VPN
  const disconnectVPN = async () => {
    setIsDisconnecting(true)
    try {
      await vpnApi.disconnect()
      toast.success(t('vpn.disconnectionSuccess'))
      fetchStatus()
    } catch (error: any) {
      toast.error(error.message || t('vpn.errors.disconnectionFailed'))
    } finally {
      setIsDisconnecting(false)
    }
  }

  // 复制Cloudflare脚本
  const copyCloudflareScript = async () => {
    try {
      await navigator.clipboard.writeText(cloudflareScript)
      setCopied(true)
      toast.success(t('vpn.scriptCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error(t('vpn.errors.copyFailed'))
    }
  }

  // 初始化
  useEffect(() => {
    fetchStatus()
    fetchCloudflareScript()

    // 每10秒刷新状态
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      {/* VPN状态卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 连接状态 */}
        <div className={cn(
          "glass-card p-6 flex flex-col items-center justify-center",
          status?.connected 
            ? "border-l-2 border-l-green-500 bg-green-50/50" 
            : "border-l-2 border-l-red-500 bg-red-50/50"
        )}>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4",
            status?.connected ? "bg-green-500/20" : "bg-red-500/20"
          )}>
            {status?.connected ? (
              <Wifi className="w-8 h-8 text-green-500" />
            ) : (
              <WifiOff className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h2 className={cn(
            "text-xl font-bold",
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>
            {status?.connected ? t('vpn.connected') : t('vpn.disconnected')}
          </h2>
          <p className={cn(
            "text-sm mt-2",
            themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300'
          )}>
            {status?.connected ? status.duration : t('vpn.readyToConnect')}
          </p>
        </div>

        {/* 流量统计 */}
        <div className="glass-card p-6">
          <h3 className={cn(
            "text-lg font-medium mb-4 flex items-center gap-2",
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>
            <Download className="w-5 h-5" />
            {t('vpn.trafficStats')}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-400'
              )}>{t('vpn.upload')}</span>
              <span className={cn(
                "font-mono",
                themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
              )}>{formatBytes(status?.upload_bytes || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-400'
              )}>{t('vpn.download')}</span>
              <span className={cn(
                "font-mono",
                themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
              )}>{formatBytes(status?.download_bytes || 0)}</span>
            </div>
          </div>
        </div>

        {/* 服务器信息 */}
        <div className="glass-card p-6">
          <h3 className={cn(
            "text-lg font-medium mb-4 flex items-center gap-2",
            themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
          )}>
            <Server className="w-5 h-5" />
            {t('vpn.serverInfo')}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-400'
              )}>{t('vpn.server')}</span>
              <span className={cn(
                "text-sm truncate max-w-[200px]",
                themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
              )}>{status?.server || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-400'
              )}>{t('vpn.protocol')}</span>
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
              )}>{status?.protocol || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn(
                "text-sm",
                themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-400'
              )}>{t('vpn.localIP')}</span>
              <span className={cn(
                "text-sm font-mono",
                themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
              )}>{status?.local_ip || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 连接控制 */}
      <div className="glass-card p-6">
        <h3 className={cn(
          "text-lg font-medium mb-4",
          themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
        )}>
          {t('vpn.connectionControl')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 连接配置表单 */}
          <div className="space-y-4">
            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300'
              )}>
                {t('vpn.serverAddress')}
              </label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="vpn.example.com"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border",
                  themeStyle === 'apple-glass' 
                    ? "bg-white/50 border-black/10 text-slate-800" 
                    : "bg-white/10 border-white/10 text-white"
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300'
                )}>
                  {t('vpn.username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border",
                    themeStyle === 'apple-glass' 
                      ? "bg-white/50 border-black/10 text-slate-800" 
                      : "bg-white/10 border-white/10 text-white"
                  )}
                />
              </div>
              
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300'
                )}>
                  {t('vpn.protocol')}
                </label>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border",
                    themeStyle === 'apple-glass' 
                      ? "bg-white/50 border-black/10 text-slate-800" 
                      : "bg-white/10 border-white/10 text-white"
                  )}
                >
                  <option value="sstp">SSTP</option>
                  <option value="l2tp">L2TP</option>
                  <option value="openvpn">OpenVPN</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300'
              )}>
                {t('vpn.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border",
                  themeStyle === 'apple-glass' 
                    ? "bg-white/50 border-black/10 text-slate-800" 
                    : "bg-white/10 border-white/10 text-white"
                )}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col gap-4 justify-center">
            <button
              onClick={connectVPN}
              disabled={isConnecting || status?.connected}
              className={cn(
                "px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                status?.connected 
                  ? "bg-green-500/20 text-green-600 cursor-not-allowed"
                  : isConnecting
                    ? "bg-blue-500/20 text-blue-600 cursor-wait"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('vpn.connecting')}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {t('vpn.connect')}
                </>
              )}
            </button>

            <button
              onClick={disconnectVPN}
              disabled={isDisconnecting || !status?.connected}
              className={cn(
                "px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                !status?.connected
                  ? "bg-red-500/20 text-red-600 cursor-not-allowed"
                  : isDisconnecting
                    ? "bg-red-500/20 text-red-600 cursor-wait"
                    : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('vpn.disconnecting')}
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  {t('vpn.disconnect')}
                </>
              )}
            </button>

            <button
              onClick={fetchStatus}
              className={cn(
                "px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 border",
                themeStyle === 'apple-glass' 
                  ? "border-black/10 bg-white/50 text-slate-800 hover:bg-white/70"
                  : "border-white/10 bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              {t('vpn.refreshStatus')}
            </button>
          </div>
        </div>
      </div>

      {/* Cloudflare脚本 */}
      <div className="glass-card p-6">
        <h3 className={cn(
          "text-lg font-medium mb-4 flex items-center justify-between",
          themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white'
        )}>
          <span>{t('vpn.cloudflareScript')}</span>
          <button
            onClick={copyCloudflareScript}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2",
              themeStyle === 'apple-glass' 
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('vpn.copied') : t('vpn.copyScript')}
          </button>
        </h3>
        
        <pre className={cn(
          "p-4 rounded-lg overflow-auto text-xs max-h-80",
          themeStyle === 'apple-glass' 
            ? "bg-black/5 text-slate-700" 
            : "bg-white/5 text-slate-300"
        )}>
          {cloudflareScript || t('vpn.loadingScript')}
        </pre>
      </div>
    </div>
  )
}