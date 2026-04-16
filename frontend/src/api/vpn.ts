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
    return await api.get<{ status: VPNStatus }>('/api/vpn/status')
  }

  // 建立VPN连接
  async connect(params: ConnectionRequest): Promise<ConnectionResult> {
    return await api.post<ConnectionResult>('/api/vpn/connect', params)
  }

  // 断开VPN连接
  async disconnect(): Promise<{ message: string }> {
    return await api.post<{ message: string }>('/api/vpn/disconnect')
  }

  // 获取Cloudflare Workers脚本
  async getCloudflareScript(): Promise<CloudflareScriptResponse> {
    return await api.get<CloudflareScriptResponse>('/api/vpn/cloudflare-script')
  }

  // 更新Cloudflare Workers脚本
  async updateCloudflareScript(script: string): Promise<{ message: string }> {
    return await api.post<{ message: string }>('/api/vpn/cloudflare-script', { script })
  }
}

export const vpnApi = new VPNApi()