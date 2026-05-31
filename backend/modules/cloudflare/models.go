package cloudflare

import "time"

// CFAccount Cloudflare 账户配置
type CFAccount struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	APIToken  string    `json:"apiToken"`  // Bearer Token 认证方式
	AccountID string    `json:"accountId"` // CF 账户 ID
	ZoneID    string    `json:"zoneId"`    // CF Zone ID
	Email     string    `json:"email"`     // 邮箱 (X-Auth-Email 方式)
	APIKey    string    `json:"apiKey"`    // API Key (X-Auth-Key 方式)
	IsDefault bool      `json:"isDefault"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CFAccountCreateRequest 创建 CF 账户请求
type CFAccountCreateRequest struct {
	Name      string `json:"name" binding:"required"`
	APIToken  string `json:"apiToken"`
	AccountID string `json:"accountId"`
	ZoneID    string `json:"zoneId"`
	Email     string `json:"email"`
	APIKey    string `json:"apiKey"`
	IsDefault bool   `json:"isDefault"`
}

// CFAccountUpdateRequest 更新 CF 账户请求
type CFAccountUpdateRequest struct {
	Name      *string `json:"name"`
	APIToken  *string `json:"apiToken"`
	AccountID *string `json:"accountId"`
	ZoneID    *string `json:"zoneId"`
	Email     *string `json:"email"`
	APIKey    *string `json:"apiKey"`
	IsDefault *bool   `json:"isDefault"`
}

// WorkerInfo Worker 信息
type WorkerInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	ModifiedOn  time.Time `json:"modifiedOn"`
	CreatedOn   time.Time `json:"createdOn"`
	Script      string    `json:"script,omitempty"`
	Bindings    []Binding `json:"bindings,omitempty"`
	Enabled     bool      `json:"enabled"`
	UsageModel  string    `json:"usageModel,omitempty"`
}

// Binding Worker 绑定 (KV 等)
type Binding struct {
	Name string `json:"name"`
	Type string `json:"type"` // kv_namespace, etc.
	// KV namespace ID (当 type 为 kv_namespace 时)
	NamespaceID string `json:"namespaceId,omitempty"`
}

// WorkerCreateRequest 创建 Worker 请求
type WorkerCreateRequest struct {
	Name       string    `json:"name" binding:"required"`
	Content    string    `json:"content"`
	Bindings   []Binding `json:"bindings,omitempty"`
}

// WorkerRouteInfo Worker 路由信息
type WorkerRouteInfo struct {
	ID      string `json:"id"`
	Pattern string `json:"pattern"`
	Script  string `json:"script"`
	ZoneID  string `json:"zoneId"`
}

// WorkerRouteRequest 绑定 Worker 到路由请求
type WorkerRouteRequest struct {
	Pattern string `json:"pattern" binding:"required"`
	ZoneID  string `json:"zoneId"`
}

// WorkerVariable Worker 环境变量
type WorkerVariable struct {
	Name  string `json:"name"`
	Type  string `json:"type"` // secret_text, plain_text
	Value string `json:"value,omitempty"`
}

// WorkerVariablesRequest 设置 Worker 环境变量请求
type WorkerVariablesRequest struct {
	Variables []WorkerVariable `json:"variables" binding:"required"`
}

// ZoneInfo Zone 信息
type ZoneInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	Paused bool   `json:"paused"`
}

// DomainInfo 自定义域名信息
type DomainInfo struct {
	Hostname string `json:"hostname"`
	Status   string `json:"status"`
	ZoneID   string `json:"zoneId"`
	ZoneName string `json:"zoneName"`
}

// KVNamespaceInfo KV 命名空间信息
type KVNamespaceInfo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SupportsURLText bool `json:"supportsUrlText,omitempty"`
}

// KVCreateRequest 创建 KV 命名空间请求
type KVCreateRequest struct {
	Title string `json:"title" binding:"required"`
}

// KVRenameRequest 重命名 KV 命名空间请求
type KVRenameRequest struct {
	Title string `json:"title" binding:"required"`
}

// KVKeyInfo KV 键信息
type KVKeyInfo struct {
	Name      string `json:"name"`
	Expiration *int64 `json:"expiration,omitempty"`
	Metadata  interface{} `json:"metadata,omitempty"`
}

// ECHDeployment ECH 部署配置
type ECHDeployment struct {
	ID        string    `json:"id"`
	AccountID string    `json:"accountId"`
	ZoneID    string    `json:"zoneId"`
	Domain    string    `json:"domain"`
	Config    string    `json:"config"` // JSON 配置
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ECHCreateRequest 创建 ECH 部署请求
type ECHCreateRequest struct {
	AccountID string `json:"accountId"`
	ZoneID    string `json:"zoneId" binding:"required"`
	Domain    string `json:"domain" binding:"required"`
	Config    string `json:"config"`
	Enabled   bool   `json:"enabled"`
}

// UsageInfo 账户使用量信息
type UsageInfo struct {
	AccountID    string `json:"accountId"`
	Requests     int64  `json:"requests"`
	Limit        int64  `json:"limit"`
	Period       string `json:"period"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CFIPScanResult CF IP 扫描结果
type CFIPScanResult struct {
	IP       string `json:"ip"`
	Latency  int    `json:"latency"` // ms
	Location string `json:"location"`
	DC       string `json:"dc"`
}

// CFConfig Cloudflare 模块配置
type CFConfig struct {
	DefaultAccountID string `json:"defaultAccountId,omitempty"`
	SyncInterval     int    `json:"syncInterval,omitempty"` // 自动同步间隔（分钟）
}

// SyncResult 同步结果
type SyncResult struct {
	Workers  int    `json:"workers"`
	Routes   int    `json:"routes"`
	Domains  int    `json:"domains"`
	Message  string `json:"message"`
}
