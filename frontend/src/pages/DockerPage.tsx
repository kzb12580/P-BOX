import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Container, Play, Square, RotateCw, Trash2,
  Terminal, Download, HardDrive, RefreshCw, X, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { dockerApi, DockerContainer, DockerImage, DockerInfo } from '@/api/docker'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

export default function DockerPage() {
  const { t } = useTranslation('docker')
  const { themeStyle } = useThemeStore()

  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [images, setImages] = useState<DockerImage[]>([])
  const [systemInfo, setSystemInfo] = useState<DockerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsContent, setLogsContent] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsContainerName, setLogsContainerName] = useState('')
  const [pullImage, setPullImage] = useState('')
  const [pulling, setPulling] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [c, img, info] = await Promise.all([
        dockerApi.getContainers(),
        dockerApi.getImages(),
        dockerApi.getSystemInfo(),
      ])
      setContainers(c || [])
      setImages(img || [])
      setSystemInfo(info)
    } catch {
      // silently fail on auto-refresh
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const setContainerActionLoading = (id: string, v: boolean) =>
    setActionLoading((prev) => ({ ...prev, [id]: v }))

  const handleStart = async (id: string, name: string) => {
    setContainerActionLoading(id, true)
    try {
      await dockerApi.startContainer(id)
      toast.success(`${name} started`)
      await fetchAll()
    } catch {
      toast.error(`Failed to start ${name}`)
    } finally {
      setContainerActionLoading(id, false)
    }
  }

  const handleStop = async (id: string, name: string) => {
    setContainerActionLoading(id, true)
    try {
      await dockerApi.stopContainer(id)
      toast.success(`${name} stopped`)
      await fetchAll()
    } catch {
      toast.error(`Failed to stop ${name}`)
    } finally {
      setContainerActionLoading(id, false)
    }
  }

  const handleRestart = async (id: string, name: string) => {
    setContainerActionLoading(id, true)
    try {
      await dockerApi.restartContainer(id)
      toast.success(`${name} restarted`)
      await fetchAll()
    } catch {
      toast.error(`Failed to restart ${name}`)
    } finally {
      setContainerActionLoading(id, false)
    }
  }

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(t('confirmRemove', { name }))) return
    setContainerActionLoading(id, true)
    try {
      await dockerApi.removeContainer(id)
      toast.success(`${name} removed`)
      await fetchAll()
    } catch {
      toast.error(`Failed to remove ${name}`)
    } finally {
      setContainerActionLoading(id, false)
    }
  }

  const handleLogs = async (id: string, name: string) => {
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsContainerName(name)
    try {
      const logs = await dockerApi.getContainerLogs(id, 200)
      setLogsContent(typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2))
    } catch {
      setLogsContent(t('logsFetchError'))
    } finally {
      setLogsLoading(false)
    }
  }

  const handlePullImage = async () => {
    if (!pullImage.trim()) return
    setPulling(true)
    try {
      await dockerApi.pullImage(pullImage.trim())
      toast.success(t('pullSuccess', { image: pullImage.trim() }))
      setPullImage('')
      await fetchAll()
    } catch {
      toast.error(t('pullFailed', { image: pullImage.trim() }))
    } finally {
      setPulling(false)
    }
  }

  const handleRemoveImage = async (id: string, tag: string) => {
    if (!confirm(t('confirmRemoveImage', { tag }))) return
    try {
      await dockerApi.removeImage(id)
      toast.success(t('imageRemoved', { tag }))
      await fetchAll()
    } catch {
      toast.error(t('imageRemoveFailed', { tag }))
    }
  }

  const isRunning = (state: string) => state?.toLowerCase() === 'running'

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (ts: number) => {
    if (!ts) return '-'
    return new Date(ts * 1000).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* System Info Card */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn('text-sm font-medium flex items-center gap-2', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
            <HardDrive className={cn('w-4 h-4', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
            {t('systemInfo')}
          </h3>
          <button onClick={fetchAll} disabled={loading} className={cn('p-2 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400')}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className={cn('w-6 h-6 animate-spin', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
          </div>
        ) : systemInfo ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t('dockerVersion'), value: systemInfo.version || '-' },
              { label: t('totalContainers'), value: systemInfo.containers },
              { label: t('runningContainers'), value: systemInfo.containersRunning },
              { label: t('stoppedContainers'), value: systemInfo.containersStopped },
              { label: t('totalImages'), value: systemInfo.images },
            ].map((item) => (
              <div key={item.label} className={cn('p-3 rounded-xl text-center', themeStyle === 'apple-glass' ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20' : 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20')}>
                <div className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>{item.label}</div>
                <div className={cn('text-lg font-semibold mt-1', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn('text-center py-6', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
            <Container className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('dockerNotAvailable')}</p>
          </div>
        )}
      </div>

      {/* Containers Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className={cn('text-sm font-medium flex items-center gap-2', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
            <Container className={cn('w-4 h-4', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
            {t('containers')}
            {containers.length > 0 && (
              <span className={cn('text-xs font-normal px-2 py-0.5 rounded-full', themeStyle === 'apple-glass' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400')}>
                {containers.length}
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn('w-6 h-6 animate-spin', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
          </div>
        ) : containers.length === 0 ? (
          <div className={cn('text-center py-12 text-sm', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
            <Container className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t('noContainers')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-white/5">
                  <th>{t('name')}</th>
                  <th>{t('image')}</th>
                  <th>{t('status')}</th>
                  <th>{t('ports')}</th>
                  <th>{t('created')}</th>
                  <th className="text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} className="group">
                    <td className={cn('font-medium', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isRunning(c.state) ? 'bg-green-500' : 'bg-red-500')} />
                        <span className="truncate max-w-[160px]" title={c.name}>{c.name}</span>
                      </div>
                    </td>
                    <td className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-600' : 'text-slate-300')}>
                      <span className="truncate max-w-[200px] block" title={c.image}>{c.image}</span>
                    </td>
                    <td>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                        isRunning(c.state)
                          ? 'bg-green-500/15 text-green-500'
                          : 'bg-red-500/15 text-red-500'
                      )}>
                        {c.status || c.state}
                      </span>
                    </td>
                    <td className={cn('text-xs font-mono', themeStyle === 'apple-glass' ? 'text-slate-500' : 'text-slate-400')}>
                      {c.ports || '-'}
                    </td>
                    <td className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {formatDate(c.created)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {isRunning(c.state) ? (
                          <>
                            <button
                              onClick={() => handleStop(c.id, c.name)}
                              disabled={actionLoading[c.id]}
                              className={cn('p-1.5 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-amber-500/10 text-amber-500' : 'hover:bg-amber-500/10 text-amber-400')}
                              title={t('stop')}
                            >
                              {actionLoading[c.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleRestart(c.id, c.name)}
                              disabled={actionLoading[c.id]}
                              className={cn('p-1.5 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-blue-500/10 text-blue-500' : 'hover:bg-cyan-500/10 text-cyan-400')}
                              title={t('restart')}
                            >
                              <RotateCw className={cn('w-3.5 h-3.5', actionLoading[c.id] && 'animate-spin')} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStart(c.id, c.name)}
                            disabled={actionLoading[c.id]}
                            className={cn('p-1.5 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-green-500/10 text-green-500' : 'hover:bg-green-500/10 text-green-400')}
                            title={t('start')}
                          >
                            {actionLoading[c.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleLogs(c.id, c.name)}
                          className={cn('p-1.5 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-slate-400')}
                          title={t('logs')}
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(c.id, c.name)}
                          disabled={actionLoading[c.id]}
                          className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-red-400"
                          title={t('remove')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Images Section */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn('text-sm font-medium flex items-center gap-2', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
            <HardDrive className={cn('w-4 h-4', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
            {t('images')}
            {images.length > 0 && (
              <span className={cn('text-xs font-normal px-2 py-0.5 rounded-full', themeStyle === 'apple-glass' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400')}>
                {images.length}
              </span>
            )}
          </h3>
        </div>

        {/* Pull Image Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={pullImage}
            onChange={(e) => setPullImage(e.target.value)}
            placeholder={t('pullPlaceholder')}
            className={cn('form-input flex-1 text-sm', themeStyle === 'apple-glass' ? 'bg-white/60' : 'bg-white/5')}
            onKeyDown={(e) => e.key === 'Enter' && handlePullImage()}
          />
          <button
            onClick={handlePullImage}
            disabled={pulling || !pullImage.trim()}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50', themeStyle === 'apple-glass' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-cyan-500 hover:bg-cyan-600')}
          >
            {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('pull')}
          </button>
        </div>

        {/* Image List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn('w-6 h-6 animate-spin', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
          </div>
        ) : images.length === 0 ? (
          <div className={cn('text-center py-8 text-sm', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
            <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t('noImages')}
          </div>
        ) : (
          <div className="space-y-2">
            {images.map((img) => (
              <div key={img.id} className={cn('flex items-center justify-between p-3 rounded-xl transition-all', themeStyle === 'apple-glass' ? 'bg-black/[0.02] hover:bg-black/[0.04]' : 'bg-white/5 hover:bg-white/10')}>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium truncate', themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-white')}>
                    {img.tags?.length > 0 ? img.tags[0] : '<none>'}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {img.id?.substring(0, 12)}
                    </span>
                    <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {formatSize(img.size)}
                    </span>
                    <span className={cn('text-xs', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {formatDate(img.created)}
                    </span>
                  </div>
                  {img.tags?.length > 1 && (
                    <div className={cn('text-xs mt-0.5', themeStyle === 'apple-glass' ? 'text-slate-400' : 'text-slate-500')}>
                      {img.tags.slice(1).join(', ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveImage(img.id, img.tags?.[0] || img.id)}
                  className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-red-400 flex-shrink-0 ml-3"
                  title={t('removeImage')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {logsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLogsOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className={cn('relative w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col', themeStyle === 'apple-glass' ? 'bg-white/90 backdrop-blur-xl' : 'bg-slate-900/90 backdrop-blur-xl border border-white/10')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10">
              <h3 className={cn('text-sm font-medium flex items-center gap-2', themeStyle === 'apple-glass' ? 'text-slate-800' : 'text-white')}>
                <Terminal className={cn('w-4 h-4', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
                {t('containerLogs')} - {logsContainerName}
              </h3>
              <button
                onClick={() => setLogsOpen(false)}
                className={cn('p-1.5 rounded-lg transition-all', themeStyle === 'apple-glass' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className={cn('w-6 h-6 animate-spin', themeStyle === 'apple-glass' ? 'text-blue-500' : 'text-cyan-400')} />
                </div>
              ) : (
                <pre className={cn('text-xs font-mono whitespace-pre-wrap break-all leading-relaxed', themeStyle === 'apple-glass' ? 'text-slate-700' : 'text-slate-300')}>
                  {logsContent || t('noLogsAvailable')}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
