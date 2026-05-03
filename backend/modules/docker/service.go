package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// dockerClient is an HTTP client that talks to the Docker daemon over a Unix socket.
var dockerClient = &http.Client{
	Transport: &http.Transport{
		DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
			return net.DialTimeout("unix", "/var/run/docker.sock", 10*time.Second)
		},
	},
	Timeout: 60 * time.Second,
}

// Service Docker管理业务逻辑
type Service struct{}

// NewService 创建Service
func NewService() *Service {
	return &Service{}
}

// dockerGet performs a GET against the Docker Engine API.
func dockerGet(path string) (*http.Response, error) {
	req, err := http.NewRequest("GET", "http://localhost"+path, nil)
	if err != nil {
		return nil, err
	}
	return dockerClient.Do(req)
}

// dockerPost performs a POST against the Docker Engine API.
func dockerPost(path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest("POST", "http://localhost"+path, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return dockerClient.Do(req)
}

// dockerDelete performs a DELETE against the Docker Engine API.
func dockerDelete(path string) (*http.Response, error) {
	req, err := http.NewRequest("DELETE", "http://localhost"+path, nil)
	if err != nil {
		return nil, err
	}
	return dockerClient.Do(req)
}

// --- Container types ---

// ContainerInfo represents a container in list output.
type ContainerInfo struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Created int64             `json:"created"`
	Ports   []PortMapping     `json:"ports"`
	SizeRw  int64             `json:"size_rw"`
	SizeRootFs int64          `json:"size_root_fs"`
}

// PortMapping represents a port mapping.
type PortMapping struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort uint16 `json:"private_port"`
	PublicPort  uint16 `json:"public_port,omitempty"`
	Type        string `json:"type"`
}

// --- Image types ---

// ImageInfo represents an image in list output.
type ImageInfo struct {
	ID       string   `json:"id"`
	Tags     []string `json:"tags"`
	Size     int64    `json:"size"`
	Created  int64    `json:"created"`
}

// --- Stats types ---

// ContainerStats holds resource usage stats.
type ContainerStats struct {
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsage    uint64  `json:"memory_usage"`
	MemoryLimit    uint64  `json:"memory_limit"`
	MemoryPercent  float64 `json:"memory_percent"`
	NetworkRxBytes uint64  `json:"network_rx_bytes"`
	NetworkTxBytes uint64  `json:"network_tx_bytes"`
}

// --- SystemInfo types ---

// DockerSystemInfo holds Docker system-level information.
type DockerSystemInfo struct {
	Version          string `json:"version"`
	APIVersion       string `json:"api_version"`
	Containers       int    `json:"containers"`
	ContainersRunning int   `json:"containers_running"`
	ContainersPaused int    `json:"containers_paused"`
	ContainersStopped int   `json:"containers_stopped"`
	Images           int    `json:"images"`
	Os               string `json:"os"`
	Arch             string `json:"arch"`
	KernelVersion    string `json:"kernel_version"`
	DockerRootDir    string `json:"docker_root_dir"`
	StorageDriver    string `json:"storage_driver"`
}

// --- docker API raw response helpers ---

type rawContainer struct {
	ID      string `json:"Id"`
	Names   []string `json:"Names"`
	Image   string `json:"Image"`
	Status  string `json:"Status"`
	State   string `json:"State"`
	Created int64  `json:"Created"`
	Ports   []struct {
		IP          string `json:"IP"`
		PrivatePort uint16 `json:"PrivatePort"`
		PublicPort  uint16 `json:"PublicPort"`
		Type        string `json:"Type"`
	} `json:"Ports"`
	SizeRw     int64 `json:"SizeRw"`
	SizeRootFs int64 `json:"SizeRootFs"`
}

type rawImage struct {
	ID       string   `json:"Id"`
	RepoTags []string `json:"RepoTags"`
	Size     int64    `json:"Size"`
	Created  int64    `json:"Created"`
}

type rawSystemInfo struct {
	Version struct {
		Version    string `json:"Version"`
		APIVersion string `json:"ApiVersion"`
		Os         string `json:"Os"`
		Arch       string `json:"Arch"`
		KernelVersion string `json:"KernelVersion"`
	} `json:"Version"`
	Containers       int    `json:"Containers"`
	ContainersRunning int   `json:"ContainersRunning"`
	ContainersPaused int    `json:"ContainersPaused"`
	ContainersStopped int   `json:"ContainersStopped"`
	Images           int    `json:"Images"`
	DockerRootDir    string `json:"DockerRootDir"`
	StorageDriver    string `json:"StorageDriver"`
}

// stats API response (partial, we only need certain fields)
type rawStats struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     int    `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64            `json:"usage"`
		Limit uint64            `json:"limit"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

// --- Service methods ---

// ListContainers returns all containers.
func (s *Service) ListContainers(all bool) ([]ContainerInfo, error) {
	path := "/v1.41/containers/json"
	if all {
		path += "?all=true"
	}
	resp, err := dockerGet(path)
	if err != nil {
		return nil, fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}

	var raw []rawContainer
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	containers := make([]ContainerInfo, 0, len(raw))
	for _, c := range raw {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		ports := make([]PortMapping, 0, len(c.Ports))
		for _, p := range c.Ports {
			ports = append(ports, PortMapping{
				IP:          p.IP,
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			})
		}
		containers = append(containers, ContainerInfo{
			ID:         c.ID[:12],
			Name:       name,
			Image:      c.Image,
			Status:     c.Status,
			State:      c.State,
			Created:    c.Created,
			Ports:      ports,
			SizeRw:     c.SizeRw,
			SizeRootFs: c.SizeRootFs,
		})
	}
	return containers, nil
}

// StartContainer starts a container by ID.
func (s *Service) StartContainer(id string) error {
	return containerAction(id, "start")
}

// StopContainer stops a container by ID.
func (s *Service) StopContainer(id string) error {
	return containerAction(id, "stop")
}

// RestartContainer restarts a container by ID.
func (s *Service) RestartContainer(id string) error {
	return containerAction(id, "restart")
}

// RemoveContainer removes a container by ID.
func (s *Service) RemoveContainer(id string, force bool) error {
	path := fmt.Sprintf("/v1.41/containers/%s", id)
	if force {
		path += "?force=true"
	}
	resp, err := dockerDelete(path)
	if err != nil {
		return fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// GetContainerLogs fetches logs for a container.
func (s *Service) GetContainerLogs(id string, tail int) (string, error) {
	path := fmt.Sprintf("/v1.41/containers/%s/logs?stdout=true&stderr=true&tail=%d", id, tail)
	resp, err := dockerGet(path)
	if err != nil {
		return "", fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}
	// Docker log stream uses an 8-byte header per frame. Strip it.
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return stripLogHeaders(raw), nil
}

// stripLogHeaders removes Docker multiplexed stream headers (8 bytes per frame).
func stripLogHeaders(data []byte) string {
	var out []byte
	i := 0
	for i < len(data) {
		if i+8 <= len(data) {
			// header: stream_type(1) + 3 padding + size(4 big-endian)
			size := int(data[i+4])<<24 | int(data[i+5])<<16 | int(data[i+6])<<8 | int(data[i+7])
			if size > 0 && i+8+size <= len(data) {
				out = append(out, data[i+8:i+8+size]...)
				i += 8 + size
				continue
			}
		}
		// Not a valid header frame — output remaining raw bytes
		out = append(out, data[i:]...)
		break
	}
	return string(out)
}

// GetContainerStats gets one-shot resource stats for a container.
func (s *Service) GetContainerStats(id string) (*ContainerStats, error) {
	path := fmt.Sprintf("/v1.41/containers/%s/stats?stream=false", id)
	resp, err := dockerGet(path)
	if err != nil {
		return nil, fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}

	var stats rawStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	// Calculate CPU percentage
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(stats.CPUStats.SystemCPUUsage - stats.PreCPUStats.SystemCPUUsage)
	cpuPercent := 0.0
	if sysDelta > 0 && cpuDelta >= 0 {
		cpuPercent = (cpuDelta / sysDelta) * float64(stats.CPUStats.OnlineCPUs) * 100.0
	}

	// Calculate memory usage (subtract cache)
	memUsage := stats.MemoryStats.Usage
	if cache, ok := stats.MemoryStats.Stats["inactive_file"]; ok {
		if memUsage > cache {
			memUsage -= cache
		}
	} else if cache, ok := stats.MemoryStats.Stats["cache"]; ok {
		if memUsage > cache {
			memUsage -= cache
		}
	}

	memLimit := stats.MemoryStats.Limit
	memPercent := 0.0
	if memLimit > 0 {
		memPercent = float64(memUsage) / float64(memLimit) * 100.0
	}

	// Network totals
	var rxBytes, txBytes uint64
	for _, net := range stats.Networks {
		rxBytes += net.RxBytes
		txBytes += net.TxBytes
	}

	return &ContainerStats{
		CPUUsage:       cpuPercent,
		MemoryUsage:    memUsage,
		MemoryLimit:    memLimit,
		MemoryPercent:  memPercent,
		NetworkRxBytes: rxBytes,
		NetworkTxBytes: txBytes,
	}, nil
}

// ListImages returns all images.
func (s *Service) ListImages() ([]ImageInfo, error) {
	resp, err := dockerGet("/v1.41/images/json")
	if err != nil {
		return nil, fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}

	var raw []rawImage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	images := make([]ImageInfo, 0, len(raw))
	for _, img := range raw {
		tags := img.RepoTags
		if tags == nil {
			tags = []string{"<none>:<none>"}
		}
		images = append(images, ImageInfo{
			ID:      img.ID,
			Tags:    tags,
			Size:    img.Size,
			Created: img.Created,
		})
	}
	return images, nil
}

// RemoveImage removes an image by ID.
func (s *Service) RemoveImage(id string, force bool) error {
	path := fmt.Sprintf("/v1.41/images/%s", id)
	if force {
		path += "?force=true"
	}
	resp, err := dockerDelete(path)
	if err != nil {
		return fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// PullImage pulls an image by name.
func (s *Service) PullImage(image string) error {
	path := fmt.Sprintf("/v1.41/images/create?fromImage=%s", image)
	resp, err := dockerPost(path, nil)
	if err != nil {
		return fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// GetSystemInfo returns Docker system information.
func (s *Service) GetSystemInfo() (*DockerSystemInfo, error) {
	// Get version
	verResp, err := dockerGet("/v1.41/version")
	if err != nil {
		return nil, fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(verResp)
	if verResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(verResp.Body)
		return nil, fmt.Errorf("docker api returned %d: %s", verResp.StatusCode, string(body))
	}
	var version struct {
		Version    string `json:"Version"`
		APIVersion string `json:"ApiVersion"`
		Os         string `json:"Os"`
		Arch       string `json:"Arch"`
		KernelVersion string `json:"KernelVersion"`
	}
	if err := json.NewDecoder(verResp.Body).Decode(&version); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	// Get info
	infoResp, err := dockerGet("/v1.41/info")
	if err != nil {
		return nil, fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(infoResp)
	if infoResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(infoResp.Body)
		return nil, fmt.Errorf("docker api returned %d: %s", infoResp.StatusCode, string(body))
	}
	var info rawSystemInfo
	if err := json.NewDecoder(infoResp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	return &DockerSystemInfo{
		Version:           version.Version,
		APIVersion:        version.APIVersion,
		Containers:        info.Containers,
		ContainersRunning: info.ContainersRunning,
		ContainersPaused:  info.ContainersPaused,
		ContainersStopped: info.ContainersStopped,
		Images:            info.Images,
		Os:                version.Os,
		Arch:              version.Arch,
		KernelVersion:     version.KernelVersion,
		DockerRootDir:     info.DockerRootDir,
		StorageDriver:     info.StorageDriver,
	}, nil
}

// containerAction sends a POST to /v1.41/containers/{id}/{action}
func containerAction(id, action string) error {
	path := fmt.Sprintf("/v1.41/containers/%s/%s", id, action)
	resp, err := dockerPost(path, nil)
	if err != nil {
		return fmt.Errorf("docker api error: %w", err)
	}
	defer drainAndClose(resp)
	// start/restart return 204, stop returns 204
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker api returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
