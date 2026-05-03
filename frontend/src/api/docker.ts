import api from './client'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: number
  ports: string
  size: string
}

export interface DockerImage {
  id: string
  tags: string[]
  size: number
  created: number
}

export interface DockerInfo {
  version: string
  containers: number
  containersRunning: number
  containersStopped: number
  images: number
}

export const dockerApi = {
  getContainers: (): Promise<DockerContainer[]> => api.get('/docker/containers'),
  startContainer: (id: string) => api.post(`/docker/containers/${id}/start`),
  stopContainer: (id: string) => api.post(`/docker/containers/${id}/stop`),
  restartContainer: (id: string) => api.post(`/docker/containers/${id}/restart`),
  removeContainer: (id: string) => api.delete(`/docker/containers/${id}`),
  getContainerLogs: (id: string, tail = 100): Promise<string> => api.get(`/docker/containers/${id}/logs?tail=${tail}`),
  getContainerStats: (id: string) => api.get(`/docker/containers/${id}/stats`),
  getImages: (): Promise<DockerImage[]> => api.get('/docker/images'),
  removeImage: (id: string) => api.delete(`/docker/images/${id}`),
  pullImage: (image: string) => api.post('/docker/images/pull', { image }),
  getSystemInfo: (): Promise<DockerInfo> => api.get('/docker/system/info'),
}
