import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import { cloudflareApi, type CFAccount, type CFWorker, type CFKVNamespace } from '@/api/cloudflare'
import { toast } from 'sonner'
import {
  Cloud, Plus, Trash2, RefreshCw, Loader2, Settings, Database, Globe, Shield, Zap,
  ChevronDown, Edit, Upload, Eye, Copy, ExternalLink, Server, Key, Code, FolderOpen,
  AlertCircle, CheckCircle, X
} from 'lucide-react'

// ==================== CF Accounts Tab ====================
function AccountsTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string, acc: CFAccount) => void }) {
  const { t } = useTranslation()
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [accounts, setAccounts] = useState<CFAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CFAccount | null>(null)
  const [form, setForm] = useState({ name: '', apiToken: '', accountId: '', zoneId: '', email: '', isDefault: false })
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<Record<string, { requests: number; limit: number; period: string }>>({})
  const [refreshingUsage, setRefreshingUsage] = useState<Record<string, boolean>>({})

  const load = async () => {
    try { setLoading(true); const r = await cloudflareApi.getAccounts(); setAccounts(Array.isArray(r) ? r : []) }
    catch { toast.error('加载账号失败') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const loadCachedUsage = async (id: number) => {
    try { const r = await cloudflareApi.getCachedUsage(id); if (r) setUsage(p => ({ ...p, [id]: r })) } catch {}
  }
  useEffect(() => { accounts.forEach(a => loadCachedUsage(a.id)) }, [accounts])

  const refreshUsage = async (id: number) => {
    setRefreshingUsage(p => ({ ...p, [id]: true }))
    try { const r = await cloudflareApi.getAccountUsage(id); if (r) setUsage(p => ({ ...p, [id]: r })) }
    catch { toast.error('刷新用量失败') } finally { setRefreshingUsage(p => ({ ...p, [id]: false })) }
  }

  const openCreate = () => { setEditing(null); setForm({ name: '', apiToken: '', accountId: '', zoneId: '', email: '', isDefault: accounts.length === 0 }); setShowForm(true) }
  const openEdit = (a: CFAccount) => { setEditing(a); setForm({ name: a.name, apiToken: '', accountId: a.accountId, zoneId: a.zoneId || '', email: a.email || '', isDefault: a.isDefault }); setShowForm(true) }

  const save = async () => {
    if (!form.name || !form.accountId) { toast.error('请填写必填字段'); return }
    if (!editing && !form.apiToken) { toast.error('请填写 API Token'); return }
    setSaving(true)
    try {
      if (editing) await cloudflareApi.updateAccount(editing.id, form)
      else await cloudflareApi.createAccount(form)
      toast.success(editing ? '更新成功' : '创建成功')
      setShowForm(false); load()
    } catch (e: any) { toast.error(e?.message || '操作失败') } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('确定删除此账号？')) return
    try { await cloudflareApi.deleteAccount(id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  const cardCls = cn('rounded-xl p-3 sm:p-4', isApple ? 'bg-white/60 backdrop-blur-xl border border-white/20' : 'bg-slate-800/50 border border-slate-700/50')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>CF 账号管理</h3>
        <button onClick={openCreate} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm', isApple ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30')}>
          <Plus className="w-4 h-4" /> 添加账号
        </button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      : accounts.length === 0 ? <div className={cn('text-center py-8', isApple ? 'text-slate-500' : 'text-slate-400')}>暂无账号</div>
      : <div className="grid gap-4">{accounts.map(a => {
          const u = usage[a.id]; const pct = u ? Math.min(100, u.requests / u.limit * 100) : 0
          return (
            <div key={a.id} className={cardCls}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium truncate', isApple ? 'text-slate-800' : 'text-white')}>{a.name}</span>
                    {a.isDefault && <span className="text-yellow-500 text-xs">★ 默认</span>}
                  </div>
                  <div className={cn('text-xs mt-1 space-y-0.5', isApple ? 'text-slate-500' : 'text-slate-400')}>
                    <div className="flex items-center gap-1"><Key className="w-3 h-3" /><span className="truncate">{a.apiToken || '••••••••'}</span></div>
                    <div className="flex items-center gap-1"><Server className="w-3 h-3" /><span className="truncate">{a.accountId}</span></div>
                    {a.email && <div className="flex items-center gap-1"><Globe className="w-3 h-3" /><span className="truncate">{a.email}</span></div>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => refreshUsage(a.id)} className="p-1.5 rounded hover:bg-white/10" disabled={refreshingUsage[a.id]}>
                    <RefreshCw className={cn('w-4 h-4', refreshingUsage[a.id] && 'animate-spin')} />
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-white/10"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded hover:bg-white/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {u && (
                <div className="mt-3 pt-3 border-t border-slate-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn('text-xs', isApple ? 'text-slate-500' : 'text-slate-400')}>用量 {u.period}</span>
                    <span className={cn('text-xs', isApple ? 'text-slate-800' : 'text-white')}>{u.requests.toLocaleString()} / {u.limit.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700/30 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}</div>}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
          <div className={cn('w-full max-w-md rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>{editing ? '编辑账号' : '添加账号'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>名称 *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} placeholder="My CF Account" /></div>
              <div><label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>API Token *</label><input value={form.apiToken} onChange={e => setForm({ ...form, apiToken: e.target.value })} type="password" className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} placeholder={editing ? '留空不修改' : '输入 API Token'} /></div>
              <div><label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>Account ID *</label><input value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} /></div>
              <div><label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>Zone ID (可选)</label><input value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })} className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} /></div>
              <div><label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>Email (可选)</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} /></div>
              <div className="flex items-center justify-between">
                <label className={cn('text-sm', isApple ? 'text-slate-600' : 'text-slate-400')}>设为默认</label>
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 rounded" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">取消</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Workers Tab ====================
function WorkersTab({ accountId }: { accountId?: string }) {
  const { t } = useTranslation()
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [workers, setWorkers] = useState<CFWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [tab, setTab] = useState<'code' | 'file' | 'folder'>('code')
  const [files, setFiles] = useState<FileList | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingWorker, setEditingWorker] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [routes, setRoutes] = useState<Record<string, string[]>>({})
  const [envVars, setEnvVars] = useState<Record<string, number>>({})
  const [showRouteDialog, setShowRouteDialog] = useState<string | null>(null)
  const [routePattern, setRoutePattern] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [w, r, d] = await Promise.all([
        cloudflareApi.getWorkers(accountId).catch(() => []),
        cloudflareApi.getRoutes(accountId).catch(() => []),
        cloudflareApi.getDomains(accountId).catch(() => [])
      ])
      setWorkers(Array.isArray(w) ? w : [])
      const routeMap: Record<string, string[]> = {}
      if (Array.isArray(r)) r.forEach((rt: any) => { if (rt.script) { routeMap[rt.script] = routeMap[rt.script] || []; routeMap[rt.script].push(rt.pattern) } })
      if (Array.isArray(d)) d.forEach((dm: any) => { if (dm.service) { routeMap[dm.service] = routeMap[dm.service] || []; routeMap[dm.service].push(dm.hostname) } })
      setRoutes(routeMap)
      if (Array.isArray(w) && w.length > 0) {
        const vars = await Promise.all((w as CFWorker[]).map(async wk => {
          try { const v = await cloudflareApi.getWorkerVariables(wk.name); return { name: wk.name, count: Array.isArray(v) ? v.length : 0 } }
          catch { return { name: wk.name, count: 0 } }
        }))
        const vm: Record<string, number> = {}; vars.forEach(v => { vm[v.name] = v.count }); setEnvVars(vm)
      }
    } catch { toast.error('加载 Workers 失败') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [accountId])

  const createWorker = async () => {
    if (!newName) { toast.error('请输入 Worker 名称'); return }
    if (tab === 'code' && !newContent) { toast.error('请输入代码'); return }
    if ((tab === 'file' || tab === 'folder') && !files) { toast.error('请选择文件'); return }
    setSaving(true)
    try {
      if (tab === 'code') await cloudflareApi.createWorker({ name: newName, content: newContent }, accountId)
      else await cloudflareApi.uploadWorker(newName, files!)
      toast.success('创建成功'); setShowCreate(false); load()
    } catch (e: any) { toast.error(e?.message || '创建失败') } finally { setSaving(false) }
  }

  const deleteWorker = async (name: string) => {
    if (!confirm(`确定删除 Worker "${name}"？`)) return
    try { await cloudflareApi.deleteWorker(name); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  const editWorker = async (name: string) => {
    try {
      const r = await cloudflareApi.getWorker(name)
      setEditingWorker(name); setEditContent(typeof r === 'string' ? r : (r as any)?.content || '')
    } catch { toast.error('获取代码失败') }
  }

  const saveWorker = async () => {
    if (!editingWorker) return
    setSaving(true)
    try { await cloudflareApi.updateWorker(editingWorker, { content: editContent }); toast.success('已更新'); setEditingWorker(null); load() }
    catch (e: any) { toast.error(e?.message || '更新失败') } finally { setSaving(false) }
  }

  const addRoute = async () => {
    if (!showRouteDialog || !routePattern.trim()) { toast.error('请输入路由规则'); return }
    try { await cloudflareApi.createRoute(showRouteDialog, routePattern); toast.success('路由已添加'); setShowRouteDialog(null); setRoutePattern(''); load() }
    catch (e: any) { toast.error(e?.message || '添加失败') }
  }

  const defaultWorkerCode = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
async function handleRequest(request) {
  return new Response('Hello Worker!', { headers: { 'content-type': 'text/plain' } })
}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>Workers 管理</h3><p className={cn('text-sm mt-1', isApple ? 'text-slate-500' : 'text-slate-400')}>管理 Cloudflare Workers</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border', isApple ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5')}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /><span className="hidden sm:inline ml-1">刷新</span>
          </button>
          <button onClick={() => { setNewName(''); setNewContent(defaultWorkerCode); setShowCreate(true) }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline ml-1">创建 Worker</span>
          </button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      : workers.length === 0 ? <div className="text-center py-8"><Cloud className="mx-auto w-12 h-12 mb-2 opacity-50" /><p className={isApple ? 'text-slate-500' : 'text-slate-400'}>暂无 Workers</p></div>
      : <div className="space-y-2">{workers.map(w => (
          <div key={w.name || w.id} className={cn('flex items-center justify-between p-4 border rounded-lg', isApple ? 'border-slate-200' : 'border-white/10')}>
            <div className="flex-1">
              <h4 className="font-medium">{w.name}</h4>
              <div className="flex items-center gap-4 mt-1">
                <p className={cn('text-sm', isApple ? 'text-slate-500' : 'text-slate-400')}>{routes[w.name]?.length > 0 ? routes[w.name].join(', ') : '未绑定路由'}</p>
                <span className={cn('text-xs', isApple ? 'text-slate-500' : 'text-slate-400')}>环境变量: {envVars[w.name] ?? '...'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => editWorker(w.name)} className="p-1.5 rounded hover:bg-white/10"><Code className="w-4 h-4" /></button>
              <button onClick={() => setShowRouteDialog(w.name)} className="p-1.5 rounded hover:bg-white/10"><Globe className="w-4 h-4" /></button>
              <button onClick={() => deleteWorker(w.name)} className="p-1.5 rounded hover:bg-white/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}</div>}

      {/* Create Worker Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className={cn('w-full max-w-lg rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>创建 Worker</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-sm">名称 *</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="my-worker" className={cn('w-full mt-1 px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} /></div>
              <div className="flex gap-2">
                {(['code', 'file', 'folder'] as const).map(tp => (
                  <button key={tp} onClick={() => setTab(tp)} className={cn('flex-1 px-3 py-2 rounded-lg text-sm border', tab === tp ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-white/10 hover:bg-white/5')}>
                    {tp === 'code' ? '代码编辑' : tp === 'file' ? '上传文件' : '上传文件夹'}
                  </button>
                ))}
              </div>
              {tab === 'code' && <div><label className="text-sm">Worker 代码</label><textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={10} className={cn('w-full mt-1 px-3 py-2 rounded-lg border font-mono text-sm', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} /></div>}
              {tab === 'file' && <div className="border-2 border-dashed rounded-lg p-8 text-center"><Upload className="mx-auto w-10 h-10 mb-2 opacity-50" /><p className="text-sm">选择 JS/TS 文件</p><input ref={fileRef} type="file" accept=".js,.ts,.mjs" onChange={e => setFiles(e.target.files)} className="hidden" /><button onClick={() => fileRef.current?.click()} className="mt-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">选择文件</button>{files && <p className="text-sm text-green-500 mt-2">已选: {files[0]?.name}</p>}</div>}
              {tab === 'folder' && <div className="border-2 border-dashed rounded-lg p-8 text-center"><FolderOpen className="mx-auto w-10 h-10 mb-2 opacity-50" /><p className="text-sm">选择文件夹</p><input ref={folderRef} type="file" onChange={e => setFiles(e.target.files)} className="hidden" {...{ webkitdirectory: '', directory: '' } as any} /><button onClick={() => folderRef.current?.click()} className="mt-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">选择文件夹</button>{files && <p className="text-sm text-green-500 mt-2">已选 {files.length} 个文件</p>}</div>}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">取消</button>
              <button onClick={createWorker} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中...' : '创建'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker Dialog */}
      {editingWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className={cn('w-full max-w-2xl rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>编辑 Worker: {editingWorker}</h3>
              <button onClick={() => setEditingWorker(null)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={20} className={cn('w-full px-3 py-2 rounded-lg border font-mono text-sm', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditingWorker(null)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">取消</button>
              <button onClick={saveWorker} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Route Dialog */}
      {showRouteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-16">
          <div className={cn('w-full max-w-md rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <h3 className={cn('text-lg font-semibold mb-4', isApple ? 'text-slate-800' : 'text-white')}>添加路由: {showRouteDialog}</h3>
            <input value={routePattern} onChange={e => setRoutePattern(e.target.value)} placeholder="example.com/*" className={cn('w-full px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowRouteDialog(null)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">取消</button>
              <button onClick={addRoute} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== KV Tab ====================
function KVTab({ accountId }: { accountId?: string }) {
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [namespaces, setNamespaces] = useState<CFKVNamespace[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [showValue, setShowValue] = useState<{ key: string; value: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showDeleteKey, setShowDeleteKey] = useState<string | null>(null)

  const load = async () => {
    try { setLoading(true); const r = await cloudflareApi.getKVNamespaces(accountId); setNamespaces(Array.isArray(r) ? r : []) }
    catch { toast.error('加载 KV 失败') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [accountId])

  const loadKeys = async (id: string) => {
    setSelected(id); setKeysLoading(true)
    try { const r = await cloudflareApi.getKVKeys(id); setKeys(Array.isArray(r) ? r : []) }
    catch { toast.error('加载键失败') } finally { setKeysLoading(false) }
  }

  const createNS = async () => {
    if (!newTitle.trim()) return; setCreating(true)
    try { await cloudflareApi.createKVNamespace(newTitle); toast.success('创建成功'); setShowCreate(false); setNewTitle(''); load() }
    catch { toast.error('创建失败') } finally { setCreating(false) }
  }

  const deleteNS = async (id: string) => {
    if (!confirm('确定删除此命名空间？')) return
    try { await cloudflareApi.deleteKVNamespace(id); toast.success('已删除'); if (selected === id) { setSelected(null); setKeys([]) } load() }
    catch { toast.error('删除失败') }
  }

  const viewValue = async (nsId: string, key: string) => {
    try { const r = await cloudflareApi.getKVValue(nsId, key); setShowValue({ key, value: typeof r === 'string' ? r : JSON.stringify(r, null, 2) }); setEditValue(typeof r === 'string' ? r : JSON.stringify(r, null, 2)) }
    catch { toast.error('获取值失败') }
  }

  const saveValue = async () => {
    if (!selected || !showValue) return
    try { await cloudflareApi.setKVValue(selected, showValue.key, editValue); toast.success('已保存'); setShowValue(null) }
    catch { toast.error('保存失败') }
  }

  const deleteKey = async () => {
    if (!selected || !showDeleteKey) return
    try { await cloudflareApi.deleteKVKey(selected, showDeleteKey); toast.success('已删除'); setShowDeleteKey(null); loadKeys(selected) }
    catch { toast.error('删除失败') }
  }

  return (
    <div className="space-y-6">
      <div className={cn('rounded-xl p-5', isApple ? 'bg-white/60 backdrop-blur-xl border border-white/20' : 'bg-slate-800/50 border border-slate-700/50')}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div><h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>KV 命名空间</h3><p className={cn('text-sm', isApple ? 'text-slate-500' : 'text-slate-400')}>管理 KV 存储</p></div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border', isApple ? 'border-slate-200' : 'border-white/10')}><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /></button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : namespaces.length === 0 ? <div className="text-center py-8"><Database className="mx-auto w-12 h-12 mb-2 opacity-50" /><p className={isApple ? 'text-slate-500' : 'text-slate-400'}>暂无命名空间</p></div>
        : <div className="space-y-2">{namespaces.map(ns => (
            <div key={ns.id} onClick={() => loadKeys(ns.id)} className={cn('flex items-center justify-between p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors', selected === ns.id ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:bg-white/5')}>
              <div className="flex-1 min-w-0"><h4 className="font-medium truncate">{ns.title}</h4><p className={cn('text-sm truncate', isApple ? 'text-slate-500' : 'text-slate-400')}>ID: {ns.id}</p></div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); deleteNS(ns.id) }} className="p-1.5 rounded hover:bg-white/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}</div>}
      </div>

      {selected && (
        <div className={cn('rounded-xl p-5', isApple ? 'bg-white/60 backdrop-blur-xl border border-white/20' : 'bg-slate-800/50 border border-slate-700/50')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>键值管理</h3>
            <button onClick={() => loadKeys(selected)} disabled={keysLoading} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border', isApple ? 'border-slate-200' : 'border-white/10')}>
              <RefreshCw className={cn('w-4 h-4', keysLoading && 'animate-spin')} />
            </button>
          </div>
          {keysLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : keys.length === 0 ? <div className="text-center py-8 text-slate-400">暂无键值对</div>
          : <div className="space-y-2">{keys.map((k: any) => (
              <div key={k.name} className={cn('flex items-center justify-between p-3 border rounded-lg', isApple ? 'border-slate-200' : 'border-white/10')}>
                <div className="flex-1 min-w-0"><h4 className="font-medium truncate">{k.name}</h4>{k.expiration && <p className="text-xs text-slate-400">过期: {new Date(k.expiration * 1000).toLocaleString()}</p>}</div>
                <div className="flex gap-2">
                  <button onClick={() => viewValue(selected, k.name)} className="p-1.5 rounded hover:bg-white/10"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => setShowDeleteKey(k.name)} className="p-1.5 rounded hover:bg-white/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}</div>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-16">
          <div className={cn('w-full max-w-md rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <h3 className={cn('text-lg font-semibold mb-4', isApple ? 'text-slate-800' : 'text-white')}>创建 KV 命名空间</h3>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="my-kv-namespace" className={cn('w-full px-3 py-2 rounded-lg border', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">取消</button>
              <button onClick={createNS} disabled={creating} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">{creating ? '创建中...' : '创建'}</button>
            </div>
          </div>
        </div>
      )}

      {showValue && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className={cn('w-full max-w-2xl rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>键值详情: {showValue.key}</h3>
              <button onClick={() => setShowValue(null)} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={10} className={cn('w-full px-3 py-2 rounded-lg border font-mono text-sm', isApple ? 'bg-white border-slate-200' : 'bg-neutral-800 border-white/10')} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowValue(null)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">关闭</button>
              <button onClick={saveValue} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={cn('w-full max-w-sm rounded-2xl p-6', isApple ? 'bg-white/90 backdrop-blur-xl' : 'bg-neutral-900 border border-white/10')}>
            <h3 className={cn('text-lg font-semibold mb-2', isApple ? 'text-slate-800' : 'text-white')}>删除键</h3>
            <p className={cn('text-sm mb-4', isApple ? 'text-slate-500' : 'text-slate-400')}>确定删除 "{showDeleteKey}"？</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteKey(null)} className="flex-1 px-4 py-2 rounded-lg border border-white/10">取消</button>
              <button onClick={deleteKey} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== ECH Tab ====================
function ECHTab() {
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [deployments, setDeployments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { setLoading(true); const r = await cloudflareApi.getECHDeployments(); setDeployments(Array.isArray(r) ? r : []) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    try { await cloudflareApi.deleteECHDeployment(id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>ECH 部署</h3>
        <button onClick={load} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border', isApple ? 'border-slate-200' : 'border-white/10')}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      : deployments.length === 0 ? <div className="text-center py-8"><Shield className="mx-auto w-12 h-12 mb-2 opacity-50" /><p className={isApple ? 'text-slate-500' : 'text-slate-400'}>暂无 ECH 部署</p></div>
      : <div className="space-y-2">{deployments.map((d: any) => (
          <div key={d.id} className={cn('flex items-center justify-between p-4 border rounded-lg', isApple ? 'border-slate-200' : 'border-white/10')}>
            <div><h4 className="font-medium">{d.domain || d.hostname || d.id}</h4><p className={cn('text-sm', isApple ? 'text-slate-500' : 'text-slate-400')}>{d.status || 'active'}</p></div>
            <button onClick={() => remove(d.id)} className="p-1.5 rounded hover:bg-white/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}</div>}
    </div>
  )
}

// ==================== CF IP Tab ====================
function CFIP() {
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [scanning, setScanning] = useState(false)

  const scan = async () => {
    setScanning(true)
    try { await cloudflareApi.scanCFIP(); toast.success('扫描完成') }
    catch { toast.error('扫描失败') } finally { setScanning(false) }
  }

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', isApple ? 'text-slate-800' : 'text-white')}>Cloudflare IP 优选</h3>
      <p className={cn('text-sm', isApple ? 'text-slate-500' : 'text-slate-400')}>扫描并测试 Cloudflare IP 延迟和速度</p>
      <button onClick={scan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {scanning ? '扫描中...' : '开始扫描'}
      </button>
    </div>
  )
}

// ==================== Main Page ====================
const TABS = [
  { key: 'accounts', label: '账号管理', icon: Key },
  { key: 'workers', label: 'Workers', icon: Code },
  { key: 'kv', label: 'KV 存储', icon: Database },
  { key: 'ech', label: 'ECH', icon: Shield },
  { key: 'cfip', label: 'IP 优选', icon: Zap },
] as const

export default function CloudflarePage() {
  const { themeStyle } = useThemeStore()
  const isApple = themeStyle === 'apple-glass'
  const [activeTab, setActiveTab] = useState<string>('accounts')
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; acc: CFAccount } | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Cloud className={cn('w-6 h-6', isApple ? 'text-blue-600' : 'text-blue-400')} />
        <div>
          <h2 className={cn('text-xl font-bold', isApple ? 'text-slate-800' : 'text-white')}>Cloudflare</h2>
          <p className={cn('text-sm', isApple ? 'text-slate-500' : 'text-slate-400')}>Workers、KV、ECH、IP 优选管理</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? (isApple ? 'bg-blue-500/10 text-blue-600 font-medium' : 'bg-blue-500/20 text-blue-400 font-medium')
                : (isApple ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5')
            )}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && <AccountsTab selectedId={selectedAccount?.id ?? null} onSelect={(id, acc) => setSelectedAccount({ id, acc })} />}
      {activeTab === 'workers' && <WorkersTab accountId={selectedAccount?.id} />}
      {activeTab === 'kv' && <KVTab accountId={selectedAccount?.id} />}
      {activeTab === 'ech' && <ECHTab />}
      {activeTab === 'cfip' && <CFIP />}
    </div>
  )
}
