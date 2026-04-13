import { api } from './client'

export interface VPNStatus {
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

export interface ConnectionRequest {
  server: string
  username?: string
  password?: string
  protocol?: string
}

export interface ConnectionResult {
  success: boolean
  message: string
  local_ip: string
  remote_ip: string
  session_id: string
}

export interface CloudflareScriptResponse {
  script: string
}

class VPNApi {
  // 获取VPN状态
  async getStatus(): Promise<{ status: VPNStatus }> {
    const response = await api.get('/api/vpn/status')
    return response.data
  }

  // 建立VPN连接
  async connect(params: ConnectionRequest): Promise<ConnectionResult> {
    const response = await api.post('/api/vpn/connect', params)
    return response.data
  }

  // 断开VPN连接
  async disconnect(): Promise<{ message: string }> {
    const response = await api.post('/api/vpn/disconnect')
    return response.data
  }

  // 获取Cloudflare Workers脚本
  async getCloudflareScript(): Promise<CloudflareScriptResponse> {
    const response = await api.get('/api/vpn/cloudflare-script')
    return response.data
  }

  // 更新Cloudflare Workers脚本
  async updateCloudflareScript(script: string): Promise<{ message: string }> {
    const response = await api.post('/api/vpn/cloudflare-script', { script })
    return response.data
  }
}

export const vpnApi = new VPNApi()