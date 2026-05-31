import api from './client'

export interface CFAccount {
  id: number
  name: string
  api_token: string
  account_id: string
  zone_id?: string
  email?: string
  is_default: boolean
  created_at: string
  updated_at: string
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
  total_requests: number
  requests_limit: number
  period: string
}

export const cloudflareApi = {
  // Accounts
  getAccounts: () => api.get<CFAccount[]>('/cloudflare/accounts'),
  createAccount: (data: Partial<CFAccount>) => api.post('/cloudflare/accounts', data),
  updateAccount: (id: number, data: Partial<CFAccount>) => api.put(`/cloudflare/accounts/${id}`, data),
  deleteAccount: (id: number) => api.delete(`/cloudflare/accounts/${id}`),
  getAccountUsage: (id: number) => api.get<CFUsage>(`/cloudflare/accounts/${id}/usage`),
  getCachedUsage: (id: number) => api.get<CFUsage>(`/cloudflare/accounts/${id}/usage/cached`),

  // Workers
  getWorkers: (cfKey?: string) => api.get<CFWorker[]>('/cloudflare/workers', { params: cfKey ? { cf_key: cfKey } : {} }),
  getWorker: (name: string) => api.get(`/cloudflare/workers/${name}`),
  createWorker: (data: { name: string; content: string; kv_bindings?: Record<string, string> }, cfKey?: string) =>
    api.post('/cloudflare/workers', data, { params: cfKey ? { cf_key: cfKey } : {} }),
  updateWorker: (name: string, data: { content: string }) => api.put(`/cloudflare/workers/${name}`, data),
  deleteWorker: (name: string) => api.delete(`/cloudflare/workers/${name}`),
  uploadWorker: (name: string, files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f, f.webkitRelativePath || f.name))
    return api.post(`/cloudflare/workers/${name}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // Routes
  getRoutes: (cfKey?: string) => api.get('/cloudflare/routes', { params: cfKey ? { cf_key: cfKey } : {} }),
  createRoute: (name: string, pattern: string) => api.post(`/cloudflare/workers/${name}/routes`, { pattern }),
  deleteRoute: (id: string) => api.delete(`/cloudflare/routes/${id}`),

  // Domains & Zones
  getDomains: (cfKey?: string) => api.get('/cloudflare/domains', { params: cfKey ? { cf_key: cfKey } : {} }),
  getZones: (cfKey?: string) => api.get('/cloudflare/zones', { params: cfKey ? { cf_key: cfKey } : {} }),

  // Worker Variables
  getWorkerVariables: (name: string) => api.get(`/cloudflare/workers/${name}/variables`),
  setWorkerVariables: (name: string, variables: Record<string, string>) =>
    api.post(`/cloudflare/workers/${name}/variables`, { variables }),

  // KV Namespaces
  getKVNamespaces: (cfKey?: string) => api.get<CFKVNamespace[]>('/cloudflare/kv/namespaces', { params: cfKey ? { cf_key: cfKey } : {} }),
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
  createECHDeployment: (data: Record<string, string>) => api.post('/cloudflare/ech-deployments', data),
  deleteECHDeployment: (id: string) => api.delete(`/cloudflare/ech-deployments/${id}`),

  // Config & Sync
  getConfig: () => api.get('/cloudflare/config'),
  sync: () => api.post('/cloudflare/sync'),

  // CF IP
  getCFLocations: () => api.get('/cloudflare/cfip/locations'),
  getCFMapping: () => api.get('/cloudflare/cfip/mapping'),
  scanCFIP: () => api.post('/cloudflare/cfip/scan'),
}
