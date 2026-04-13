package vpn

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type VPNStatus struct {
	Connected    bool      `json:"connected"`
	Server       string    `json:"server"`
	Protocol     string    `json:"protocol"`
	LocalIP      string    `json:"local_ip"`
	RemoteIP     string    `json:"remote_ip"`
	ConnectTime  time.Time `json:"connect_time"`
	Duration     string    `json:"duration"`
	UploadBytes  int64     `json:"upload_bytes"`
	DownloadBytes int64     `json:"download_bytes"`
}

type ConnectionResult struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	LocalIP   string `json:"local_ip"`
	RemoteIP  string `json:"remote_ip"`
	SessionID string `json:"session_id"`
}

type VPNService struct {
	mu          sync.RWMutex
	status      *VPNStatus
	configPath  string
	cloudflareScript string
}

func NewService() *VPNService {
	return &VPNService{
		status: &VPNStatus{
			Connected: false,
		},
		configPath: "data/vpn/config.json",
		cloudflareScript: getDefaultCloudflareScript(),
	}
}

// GetStatus 获取VPN连接状态
func (s *VPNService) GetStatus() (*VPNStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 模拟状态更新
	if s.status.Connected {
		s.status.Duration = time.Since(s.status.ConnectTime).String()
	}

	return s.status, nil
}

// Connect 建立VPN连接
func (s *VPNService) Connect(server, username, password, protocol string) (*ConnectionResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 检查是否已连接
	if s.status.Connected {
		return nil, fmt.Errorf("VPN连接已存在")
	}

	// 模拟连接过程
	time.Sleep(2 * time.Second)

	// 更新连接状态
	s.status = &VPNStatus{
		Connected:   true,
		Server:      server,
		Protocol:    protocol,
		LocalIP:     "192.168.1.100",     // 模拟本地IP
		RemoteIP:    "203.0.113.1",      // 模拟远程IP
		ConnectTime: time.Now(),
		UploadBytes:   0,
		DownloadBytes: 0,
	}

	// 保存配置
	config := map[string]string{
		"server":   server,
		"username": username,
		"protocol": protocol,
	}

	if err := s.saveConfig(config); err != nil {
		return nil, fmt.Errorf("保存配置失败: %v", err)
	}

	return &ConnectionResult{
		Success:   true,
		Message:   "VPN连接已成功建立",
		LocalIP:   s.status.LocalIP,
		RemoteIP:  s.status.RemoteIP,
		SessionID: fmt.Sprintf("vpn-%d", time.Now().Unix()),
	}, nil
}

// Disconnect 断开VPN连接
func (s *VPNService) Disconnect() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.status.Connected {
		return fmt.Errorf("VPN连接不存在")
	}

	// 模拟断开过程
	time.Sleep(1 * time.Second)

	// 更新状态
	s.status = &VPNStatus{
		Connected: false,
	}

	return nil
}

// GetCloudflareScript 获取Cloudflare Workers脚本
func (s *VPNService) GetCloudflareScript() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 如果脚本文件存在，从文件读取
	scriptPath := filepath.Join(filepath.Dir(s.configPath), "cloudflare.js")
	if data, err := os.ReadFile(scriptPath); err == nil {
		return string(data), nil
	}

	// 返回默认脚本
	return s.cloudflareScript, nil
}

// UpdateCloudflareScript 更新Cloudflare Workers脚本
func (s *VPNService) UpdateCloudflareScript(script string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cloudflareScript = script

	// 保存到文件
	scriptPath := filepath.Join(filepath.Dir(s.configPath), "cloudflare.js")
	if err := os.MkdirAll(filepath.Dir(scriptPath), 0755); err != nil {
		return fmt.Errorf("创建目录失败: %v", err)
	}

	if err := os.WriteFile(scriptPath, []byte(script), 0644); err != nil {
		return fmt.Errorf("保存脚本失败: %v", err)
	}

	return nil
}

// saveConfig 保存VPN配置
func (s *VPNService) saveConfig(config map[string]string) error {
	if err := os.MkdirAll(filepath.Dir(s.configPath), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.configPath, data, 0644)
}

// loadConfig 加载VPN配置
func (s *VPNService) loadConfig() (map[string]string, error) {
	data, err := os.ReadFile(s.configPath)
	if err != nil {
		return nil, err
	}

	var config map[string]string
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return config, nil
}

// getDefaultCloudflareScript 获取默认的Cloudflare Workers脚本
func getDefaultCloudflareScript() string {
	return `import { connect } from 'cloudflare:sockets';
const uuid = '2523c510-9ff0-415b-9582-93949bfae7e3', maxED = 8192, MSS = 1400;
export default { fetch: req => req.headers.get('Upgrade') === 'websocket' ? ws(req) : new Response('ok') };

// SoftEther SSTP VPN客户端实现
// 完整代码...`
}