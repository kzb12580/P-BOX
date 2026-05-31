import api from './client'

export interface CFAccount {
  id: string
  name: string
  apiToken: string
  accountId: string
  zoneId?: string
  email?: string
  apiKey?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CFWorker {
  id: string
  name: string
  content?: string
  routes?: string[]
  envVars?: number
}

export interface CFKVNamespace {
  id: string
  title: string
}

export interface CFUsage {
  requests: number
  limit: number
  period: string
  accountId: string
}

export const cloudflareApi = {
  // Accounts
  getAccounts: () => api.get<CFAccount[]>('/cloudflare/accounts'),
  createAccount: (data: Partial<CFAccount>) => api.post('/cloudflare/accounts', data),
  updateAccount: (id: string, data: Partial<CFAccount>) => api.put(`/cloudflare/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete(`/cloudflare/accounts/${id}`),
  getAccountUsage: (id: string) => api.get<CFUsage>(`/cloudflare/accounts/${id}/usage`),
  getCachedUsage: (id: string) => api.get<CFUsage>(`/cloudflare/accounts/${id}/usage/cached`),

  // Workers - 后端用 accountId 查询参数
  getWorkers: (accountId?: string) => api.get<CFWorker[]>('/cloudflare/workers', { params: accountId ? { accountId } : {} }),
  getWorker: (name: string) => api.get(`/cloudflare/workers/${name}`),
  createWorker: (data: { name: string; content: string; bindings?: any[] }, accountId?: string) =>
    api.post('/cloudflare/workers', data, { params: accountId ? { accountId } : {} }),
  updateWorker: (name: string, data: { content: string }) => api.put(`/cloudflare/workers/${name}`, data),
  deleteWorker: (name: string) => api.delete(`/cloudflare/workers/${name}`),
  uploadWorker: (name: string, files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('file', f, f.webkitRelativePath || f.name))
    return api.post(`/cloudflare/workers/${name}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // Routes
  getRoutes: (accountId?: string) => api.get('/cloudflare/routes', { params: accountId ? { accountId } : {} }),
  createRoute: (name: string, pattern: string, zoneId?: string) => api.post(`/cloudflare/workers/${name}/routes`, { pattern, zoneId }),
  deleteRoute: (id: string) => api.delete(`/cloudflare/routes/${id}`),

  // Domains & Zones
  getDomains: (accountId?: string) => api.get('/cloudflare/domains', { params: accountId ? { accountId } : {} }),
  getZones: (accountId?: string) => api.get('/cloudflare/zones', { params: accountId ? { accountId } : {} }),

  // Worker Variables
  getWorkerVariables: (name: string) => api.get(`/cloudflare/workers/${name}/variables`),
  setWorkerVariables: (name: string, variables: Array<{ name: string; type: string; value: string }>) =>
    api.post(`/cloudflare/workers/${name}/variables`, { variables }),

  // KV Namespaces
  getKVNamespaces: (accountId?: string) => api.get<CFKVNamespace[]>('/cloudflare/kv/namespaces', { params: accountId ? { accountId } : {} }),
  createKVNamespace: (title: string) => api.post('/cloudflare/kv/namespaces', { title }),
  deleteKVNamespace: (id: string) => api.delete(`/cloudflare/kv/namespaces/${id}`),
  renameKVNamespace: (id: string, title: string) => api.put(`/cloudflare/kv/namespaces/${id}`, { title }),
  getKVKeys: (namespaceId: string) => api.get(`/cloudflare/kv/namespaces/${namespaceId}/keys`),
  getKVValue: (namespaceId: string, key: string) => api.get(`/cloudflare/kv/namespaces/${namespaceId}/values/${key}`),
  setKVValue: (namespaceId: string, key: string, value: string) =>
    api.put(`/cloudflare/kv/namespaces/${namespaceId}/values/${key}`, { value }),
  deleteKVKey: (namespaceId: string, key: string) => api.delete(`/cloudflare/kv/namespaces/${namespaceId}/keys/${key}`),

  // ECH Deployments
  getECHDeployments: () => api.get('/cloudflare/ech-deployments'),
  createECHDeployment: (data: { accountId: string; zoneId: string; domain: string; config?: string }) =>
    api.post('/cloudflare/ech-deployments', data),
  deleteECHDeployment: (id: string) => api.delete(`/cloudflare/ech-deployments/${id}`),

  // Config & Sync
  getConfig: () => api.get('/cloudflare/config'),
  sync: () => api.post('/cloudflare/sync'),

  // CF IP
  getCFLocations: () => api.get('/cloudflare/cfip/locations'),
  getCFMapping: () => api.get('/cloudflare/cfip/mapping'),
  scanCFIP: () => api.post('/cloudflare/cfip/scan'),
}
