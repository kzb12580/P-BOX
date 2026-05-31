package cloudflare

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Service Cloudflare 业务逻辑服务
type Service struct {
	dataDir    string
	mu         sync.RWMutex
	accounts   []CFAccount
	echDeploys []ECHDeployment
	config     CFConfig
	httpClient *http.Client
}

// NewService 创建 Service
func NewService(dataDir string) *Service {
	s := &Service{
		dataDir:    dataDir,
		accounts:   make([]CFAccount, 0),
		echDeploys: make([]ECHDeployment, 0),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	s.loadAccounts()
	s.loadECHDeployments()
	s.loadConfig()
	return s
}

// ========== 数据持久化 ==========

// accountsFilePath 账户数据文件路径
func (s *Service) accountsFilePath() string {
	return filepath.Join(s.dataDir, "cf_accounts.json")
}

// echFilePath ECH 部署数据文件路径
func (s *Service) echFilePath() string {
	return filepath.Join(s.dataDir, "cf_ech_deployments.json")
}

// configFilePath 配置文件路径
func (s *Service) configFilePath() string {
	return filepath.Join(s.dataDir, "cf_config.json")
}

// usageCacheFilePath 使用量缓存文件路径
func (s *Service) usageCacheFilePath() string {
	return filepath.Join(s.dataDir, "cf_usage_cache.json")
}

// loadAccounts 加载账户数据
func (s *Service) loadAccounts() {
	data, err := os.ReadFile(s.accountsFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &s.accounts)
}

// saveAccounts 保存账户数据
func (s *Service) saveAccounts() error {
	data, err := json.MarshalIndent(s.accounts, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.accountsFilePath(), data, 0644)
}

// loadECHDeployments 加载 ECH 部署数据
func (s *Service) loadECHDeployments() {
	data, err := os.ReadFile(s.echFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &s.echDeploys)
}

// saveECHDeployments 保存 ECH 部署数据
func (s *Service) saveECHDeployments() error {
	data, err := json.MarshalIndent(s.echDeploys, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.echFilePath(), data, 0644)
}

// loadConfig 加载配置
func (s *Service) loadConfig() {
	data, err := os.ReadFile(s.configFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &s.config)
}

// saveConfig 保存配置
func (s *Service) saveConfig() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.configFilePath(), data, 0644)
}

// loadUsageCache 加载使用量缓存
func (s *Service) loadUsageCache() map[string]UsageInfo {
	result := make(map[string]UsageInfo)
	data, err := os.ReadFile(s.usageCacheFilePath())
	if err != nil {
		return result
	}
	json.Unmarshal(data, &result)
	return result
}

// saveUsageCache 保存使用量缓存
func (s *Service) saveUsageCache(cache map[string]UsageInfo) error {
	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.usageCacheFilePath(), data, 0644)
}

// ========== 账户管理 ==========

// ListAccounts 获取所有账户
func (s *Service) ListAccounts() []CFAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()
	// 返回时隐藏敏感信息
	result := make([]CFAccount, len(s.accounts))
	copy(result, s.accounts)
	for i := range result {
		if result[i].APIToken != "" {
			result[i].APIToken = maskToken(result[i].APIToken)
		}
		if result[i].APIKey != "" {
			result[i].APIKey = maskToken(result[i].APIKey)
		}
	}
	return result
}

// maskToken 掩码令牌
func maskToken(token string) string {
	if len(token) <= 8 {
		return "****"
	}
	return token[:4] + "****" + token[len(token)-4:]
}

// CreateAccount 创建账户
func (s *Service) CreateAccount(req CFAccountCreateRequest) (*CFAccount, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	account := CFAccount{
		ID:        uuid.New().String(),
		Name:      req.Name,
		APIToken:  req.APIToken,
		AccountID: req.AccountID,
		ZoneID:    req.ZoneID,
		Email:     req.Email,
		APIKey:    req.APIKey,
		IsDefault: req.IsDefault,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 如果设置为默认账户，取消其他默认
	if req.IsDefault {
		for i := range s.accounts {
			s.accounts[i].IsDefault = false
		}
	}

	s.accounts = append(s.accounts, account)
	if err := s.saveAccounts(); err != nil {
		return nil, fmt.Errorf("保存账户失败: %w", err)
	}
	return &account, nil
}

// UpdateAccount 更新账户
func (s *Service) UpdateAccount(id string, req CFAccountUpdateRequest) (*CFAccount, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx := -1
	for i, a := range s.accounts {
		if a.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return nil, fmt.Errorf("账户不存在: %s", id)
	}

	account := &s.accounts[idx]
	if req.Name != nil {
		account.Name = *req.Name
	}
	if req.APIToken != nil {
		account.APIToken = *req.APIToken
	}
	if req.AccountID != nil {
		account.AccountID = *req.AccountID
	}
	if req.ZoneID != nil {
		account.ZoneID = *req.ZoneID
	}
	if req.Email != nil {
		account.Email = *req.Email
	}
	if req.APIKey != nil {
		account.APIKey = *req.APIKey
	}
	if req.IsDefault != nil {
		account.IsDefault = *req.IsDefault
		if *req.IsDefault {
			for i := range s.accounts {
				if i != idx {
					s.accounts[i].IsDefault = false
				}
			}
		}
	}
	account.UpdatedAt = time.Now()

	if err := s.saveAccounts(); err != nil {
		return nil, fmt.Errorf("保存账户失败: %w", err)
	}
	return account, nil
}

// DeleteAccount 删除账户
func (s *Service) DeleteAccount(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, a := range s.accounts {
		if a.ID == id {
			s.accounts = append(s.accounts[:i], s.accounts[i+1:]...)
			return s.saveAccounts()
		}
	}
	return fmt.Errorf("账户不存在: %s", id)
}

// GetAccount 获取账户（内部使用，不掩码）
func (s *Service) GetAccount(id string) (*CFAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for i, a := range s.accounts {
		if a.ID == id {
			return &s.accounts[i], nil
		}
	}
	return nil, fmt.Errorf("账户不存在: %s", id)
}

// GetDefaultAccount 获取默认账户
func (s *Service) GetDefaultAccount() (*CFAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for i, a := range s.accounts {
		if a.IsDefault {
			return &s.accounts[i], nil
		}
	}
	// 如果没有默认账户，返回第一个
	if len(s.accounts) > 0 {
		return &s.accounts[0], nil
	}
	return nil, fmt.Errorf("没有配置 Cloudflare 账户")
}

// ========== CF API 调用 ==========

// cfAPI 执行 Cloudflare API 请求
func (s *Service) cfAPI(method, path string, body interface{}, account *CFAccount) ([]byte, error) {
	baseURL := "https://api.cloudflare.com/client/v4"
	url := baseURL + path

	var bodyReader io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("序列化请求失败: %w", err)
		}
		bodyReader = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置认证头
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if account.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else if account.Email != "" && account.APIKey != "" {
		req.Header.Set("X-Auth-Email", account.Email)
		req.Header.Set("X-Auth-Key", account.APIKey)
	} else {
		return nil, fmt.Errorf("账户认证信息不完整")
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API 返回错误 [%d]: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// cfAPIResult CF API 通用响应结构
type cfAPIResult struct {
	Success  bool            `json:"success"`
	Errors   []cfAPIError    `json:"errors"`
	Messages []string        `json:"messages"`
	Result   json.RawMessage `json:"result"`
}

// cfAPIError CF API 错误
type cfAPIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ========== Workers 管理 ==========

// ListWorkers 获取 Worker 列表
func (s *Service) ListWorkers(accountID string) ([]WorkerInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/accounts/%s/workers/scripts", account.AccountID)
	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	var workers []WorkerInfo
	json.Unmarshal(result.Result, &workers)
	if workers == nil {
		workers = make([]WorkerInfo, 0)
	}
	return workers, nil
}

// GetWorker 获取 Worker 脚本内容
func (s *Service) GetWorker(accountID, name string) (*WorkerInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	// 获取脚本内容
	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s", account.AccountID, name)
	req, err := http.NewRequest("GET", "https://api.cloudflare.com/client/v4"+path, nil)
	if err != nil {
		return nil, err
	}
	if account.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		req.Header.Set("X-Auth-Email", account.Email)
		req.Header.Set("X-Auth-Key", account.APIKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	scriptContent, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("获取 Worker 失败 [%d]: %s", resp.StatusCode, string(scriptContent))
	}

	return &WorkerInfo{
		Name:   name,
		Script: string(scriptContent),
	}, nil
}

// CreateWorker 创建 Worker
func (s *Service) CreateWorker(accountID string, req WorkerCreateRequest) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	// 构建 multipart 表单
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// 添加脚本元数据
	metadata := map[string]interface{}{
		"bindings": buildBindings(req.Bindings),
	}
	metadataJSON, _ := json.Marshal(metadata)
	part, _ := writer.CreateFormField("metadata")
	part.Write(metadataJSON)

	// 添加脚本内容
	part, _ = writer.CreateFormFile("script", req.Name+".js")
	part.Write([]byte(req.Content))

	writer.Close()

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s", account.AccountID, req.Name)
	url := "https://api.cloudflare.com/client/v4" + path

	httpReq, err := http.NewRequest("PUT", url, &buf)
	if err != nil {
		return err
	}
	if account.APIToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		httpReq.Header.Set("X-Auth-Email", account.Email)
		httpReq.Header.Set("X-Auth-Key", account.APIKey)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("创建 Worker 失败 [%d]: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// buildBindings 构建绑定配置
func buildBindings(bindings []Binding) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(bindings))
	for _, b := range bindings {
		binding := map[string]interface{}{
			"name": b.Name,
			"type": b.Type,
		}
		if b.Type == "kv_namespace" && b.NamespaceID != "" {
			binding["namespace_id"] = b.NamespaceID
		}
		result = append(result, binding)
	}
	return result
}

// UpdateWorker 更新 Worker 脚本
func (s *Service) UpdateWorker(accountID, name, content string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	metadata := map[string]interface{}{"bindings": []interface{}{}}
	metadataJSON, _ := json.Marshal(metadata)
	part, _ := writer.CreateFormField("metadata")
	part.Write(metadataJSON)

	part, _ = writer.CreateFormFile("script", name+".js")
	part.Write([]byte(content))
	writer.Close()

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s", account.AccountID, name)
	url := "https://api.cloudflare.com/client/v4" + path

	httpReq, err := http.NewRequest("PUT", url, &buf)
	if err != nil {
		return err
	}
	if account.APIToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		httpReq.Header.Set("X-Auth-Email", account.Email)
		httpReq.Header.Set("X-Auth-Key", account.APIKey)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("更新 Worker 失败 [%d]: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// DeleteWorker 删除 Worker
func (s *Service) DeleteWorker(accountID, name string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s", account.AccountID, name)
	_, err = s.cfAPI("DELETE", path, nil, account)
	return err
}

// UploadWorkerFiles 上传 Worker 文件（multipart）
func (s *Service) UploadWorkerFiles(accountID, name string, fileContent []byte, metadata map[string]interface{}) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	metadataJSON, _ := json.Marshal(metadata)
	part, _ := writer.CreateFormField("metadata")
	part.Write(metadataJSON)

	part, _ = writer.CreateFormFile("script", name+".js")
	part.Write(fileContent)
	writer.Close()

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s", account.AccountID, name)
	url := "https://api.cloudflare.com/client/v4" + path

	httpReq, err := http.NewRequest("PUT", url, &buf)
	if err != nil {
		return err
	}
	if account.APIToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		httpReq.Header.Set("X-Auth-Email", account.Email)
		httpReq.Header.Set("X-Auth-Key", account.APIKey)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("上传 Worker 失败 [%d]: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// BindWorkerToRoute 绑定 Worker 到路由
func (s *Service) BindWorkerToRoute(accountID, name string, req WorkerRouteRequest) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	zoneID := req.ZoneID
	if zoneID == "" {
		zoneID = account.ZoneID
	}
	if zoneID == "" {
		return fmt.Errorf("未指定 Zone ID")
	}

	body := map[string]interface{}{
		"pattern": req.Pattern,
		"script":  name,
	}

	path := fmt.Sprintf("/zones/%s/workers/routes", zoneID)
	_, err = s.cfAPI("POST", path, body, account)
	return err
}

// GetWorkerVariables 获取 Worker 环境变量
func (s *Service) GetWorkerVariables(accountID, name string) ([]WorkerVariable, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s/settings", account.AccountID, name)
	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var settings struct {
		Bindings []struct {
			Name         string `json:"name"`
			Type         string `json:"type"`
			Text         string `json:"text,omitempty"`
			Encrypted    string `json:"encrypted,omitempty"`
			NamespaceID  string `json:"namespace_id,omitempty"`
		} `json:"bindings"`
	}
	json.Unmarshal(result.Result, &settings)

	variables := make([]WorkerVariable, 0, len(settings.Bindings))
	for _, b := range settings.Bindings {
		v := WorkerVariable{
			Name: b.Name,
			Type: b.Type,
		}
		if b.Type == "plain_text" || b.Type == "secret_text" {
			v.Value = b.Text
		}
		variables = append(variables, v)
	}
	return variables, nil
}

// SetWorkerVariables 设置 Worker 环境变量
func (s *Service) SetWorkerVariables(accountID, name string, vars []WorkerVariable) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	bindings := make([]map[string]interface{}, 0, len(vars))
	for _, v := range vars {
		binding := map[string]interface{}{
			"name": v.Name,
			"type": v.Type,
		}
		if v.Type == "plain_text" || v.Type == "secret_text" {
			binding["text"] = v.Value
		}
		bindings = append(bindings, binding)
	}

	body := map[string]interface{}{
		"bindings": bindings,
	}

	path := fmt.Sprintf("/accounts/%s/workers/scripts/%s/settings", account.AccountID, name)
	_, err = s.cfAPI("PATCH", path, body, account)
	return err
}

// ========== 路由管理 ==========

// ListRoutes 获取所有路由
func (s *Service) ListRoutes(accountID string) ([]WorkerRouteInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	zoneID := account.ZoneID
	if zoneID == "" {
		return nil, fmt.Errorf("账户未配置 Zone ID")
	}

	path := fmt.Sprintf("/zones/%s/workers/routes", zoneID)
	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var routes []WorkerRouteInfo
	json.Unmarshal(result.Result, &routes)
	if routes == nil {
		routes = make([]WorkerRouteInfo, 0)
	}
	return routes, nil
}

// DeleteRoute 删除路由
func (s *Service) DeleteRoute(accountID, routeID string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	zoneID := account.ZoneID
	if zoneID == "" {
		return fmt.Errorf("账户未配置 Zone ID")
	}

	path := fmt.Sprintf("/zones/%s/workers/routes/%s", zoneID, routeID)
	_, err = s.cfAPI("DELETE", path, nil, account)
	return err
}

// ========== Zone & 域名 ==========

// ListZones 获取所有 Zone
func (s *Service) ListZones(accountID string) ([]ZoneInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	respBody, err := s.cfAPI("GET", "/zones?per_page=50", nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var zones []ZoneInfo
	json.Unmarshal(result.Result, &zones)
	if zones == nil {
		zones = make([]ZoneInfo, 0)
	}
	return zones, nil
}

// ListDomains 获取自定义域名列表
func (s *Service) ListDomains(accountID string) ([]DomainInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	// 获取 Worker 自定义域名
	path := fmt.Sprintf("/accounts/%s/workers/domains", account.AccountID)
	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		// 如果不支持，返回空列表
		return make([]DomainInfo, 0), nil
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return make([]DomainInfo, 0), nil
	}

	var domains []DomainInfo
	json.Unmarshal(result.Result, &domains)
	if domains == nil {
		domains = make([]DomainInfo, 0)
	}
	return domains, nil
}

// ========== KV 管理 ==========

// ListKVNamespaces 获取 KV 命名空间列表
func (s *Service) ListKVNamespaces(accountID string) ([]KVNamespaceInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces?per_page=100", account.AccountID)
	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var namespaces []KVNamespaceInfo
	json.Unmarshal(result.Result, &namespaces)
	if namespaces == nil {
		namespaces = make([]KVNamespaceInfo, 0)
	}
	return namespaces, nil
}

// CreateKVNamespace 创建 KV 命名空间
func (s *Service) CreateKVNamespace(accountID string, req KVCreateRequest) (*KVNamespaceInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces", account.AccountID)
	respBody, err := s.cfAPI("POST", path, map[string]string{"title": req.Title}, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var ns KVNamespaceInfo
	json.Unmarshal(result.Result, &ns)
	return &ns, nil
}

// DeleteKVNamespace 删除 KV 命名空间
func (s *Service) DeleteKVNamespace(accountID, nsID string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s", account.AccountID, nsID)
	_, err = s.cfAPI("DELETE", path, nil, account)
	return err
}

// RenameKVNamespace 重命名 KV 命名空间
func (s *Service) RenameKVNamespace(accountID, nsID string, req KVRenameRequest) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s", account.AccountID, nsID)
	_, err = s.cfAPI("PUT", path, map[string]string{"title": req.Title}, account)
	return err
}

// ListKVKeys 列出 KV 命名空间中的键
func (s *Service) ListKVKeys(accountID, nsID string, prefix string, limit int) ([]KVKeyInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 100
	}
	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s/keys?limit=%d", account.AccountID, nsID, limit)
	if prefix != "" {
		path += "&prefix=" + prefix
	}

	respBody, err := s.cfAPI("GET", path, nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var keys []KVKeyInfo
	json.Unmarshal(result.Result, &keys)
	if keys == nil {
		keys = make([]KVKeyInfo, 0)
	}
	return keys, nil
}

// GetKVValue 获取 KV 值
func (s *Service) GetKVValue(accountID, nsID, key string) (string, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return "", err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s/values/%s", account.AccountID, nsID, key)
	req, err := http.NewRequest("GET", "https://api.cloudflare.com/client/v4"+path, nil)
	if err != nil {
		return "", err
	}
	if account.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		req.Header.Set("X-Auth-Email", account.Email)
		req.Header.Set("X-Auth-Key", account.APIKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("获取 KV 值失败 [%d]: %s", resp.StatusCode, string(body))
	}
	return string(body), nil
}

// SetKVValue 设置 KV 值
func (s *Service) SetKVValue(accountID, nsID, key, value string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s/values/%s", account.AccountID, nsID, key)
	url := "https://api.cloudflare.com/client/v4" + path

	httpReq, err := http.NewRequest("PUT", url, strings.NewReader(value))
	if err != nil {
		return err
	}
	if account.APIToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+account.APIToken)
	} else {
		httpReq.Header.Set("X-Auth-Email", account.Email)
		httpReq.Header.Set("X-Auth-Key", account.APIKey)
	}
	httpReq.Header.Set("Content-Type", "text/plain")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("设置 KV 值失败 [%d]: %s", resp.StatusCode, string(body))
	}
	return nil
}

// DeleteKVKey 删除 KV 键
func (s *Service) DeleteKVKey(accountID, nsID, key string) error {
	account, err := s.findAccount(accountID)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("/accounts/%s/storage/kv/namespaces/%s/keys/%s", account.AccountID, nsID, key)
	_, err = s.cfAPI("DELETE", path, nil, account)
	return err
}

// ========== ECH 部署 ==========

// ListECHDeployments 获取 ECH 部署列表
func (s *Service) ListECHDeployments() []ECHDeployment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.echDeploys
}

// CreateECHDeployment 创建 ECH 部署
func (s *Service) CreateECHDeployment(req ECHCreateRequest) (*ECHDeployment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deploy := ECHDeployment{
		ID:        uuid.New().String(),
		AccountID: req.AccountID,
		ZoneID:    req.ZoneID,
		Domain:    req.Domain,
		Config:    req.Config,
		Enabled:   req.Enabled,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	s.echDeploys = append(s.echDeploys, deploy)
	if err := s.saveECHDeployments(); err != nil {
		return nil, fmt.Errorf("保存 ECH 部署失败: %w", err)
	}
	return &deploy, nil
}

// DeleteECHDeployment 删除 ECH 部署
func (s *Service) DeleteECHDeployment(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, d := range s.echDeploys {
		if d.ID == id {
			s.echDeploys = append(s.echDeploys[:i], s.echDeploys[i+1:]...)
			return s.saveECHDeployments()
		}
	}
	return fmt.Errorf("ECH 部署不存在: %s", id)
}

// ========== 使用量 ==========

// GetAccountUsage 获取账户使用量（从 CF API 实时获取）
func (s *Service) GetAccountUsage(accountID string) (*UsageInfo, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	// 请求 CF API 获取账户级别请求分析
	path := fmt.Sprintf("/accounts/%s/analytics/dashboard", account.AccountID)
	respBody, err := s.cfAPI("GET", path+"?since=-1440&continuous=true", nil, account)
	if err != nil {
		return nil, err
	}

	var result cfAPIResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	var analytics struct {
		Totals struct {
			Requests struct {
				All int64 `json:"all"`
			} `json:"requests"`
		} `json:"totals"`
	}
	json.Unmarshal(result.Result, &analytics)

	usage := &UsageInfo{
		AccountID: accountID,
		Requests:  analytics.Totals.Requests.All,
		UpdatedAt: time.Now(),
	}

	// 缓存使用量
	cache := s.loadUsageCache()
	cache[accountID] = *usage
	s.saveUsageCache(cache)

	return usage, nil
}

// GetCachedUsage 获取缓存的使用量数据
func (s *Service) GetCachedUsage(accountID string) (*UsageInfo, error) {
	cache := s.loadUsageCache()
	usage, ok := cache[accountID]
	if !ok {
		return nil, fmt.Errorf("没有缓存的使用量数据")
	}
	return &usage, nil
}

// ========== 配置 & 同步 ==========

// GetConfig 获取 CF 模块配置
func (s *Service) GetConfig() CFConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// SyncData 同步 Workers/Routes/Domains 数据
func (s *Service) SyncData(accountID string) (*SyncResult, error) {
	account, err := s.findAccount(accountID)
	if err != nil {
		return nil, err
	}

	result := &SyncResult{}

	// 同步 Workers
	workers, err := s.ListWorkers(account.ID)
	if err == nil {
		result.Workers = len(workers)
	}

	// 同步 Routes
	routes, err := s.ListRoutes(account.ID)
	if err == nil {
		result.Routes = len(routes)
	}

	// 同步 Domains
	domains, err := s.ListDomains(account.ID)
	if err == nil {
		result.Domains = len(domains)
	}

	result.Message = fmt.Sprintf("同步完成: %d Workers, %d Routes, %d Domains", result.Workers, result.Routes, result.Domains)
	return result, nil
}

// ========== CF IP 工具 ==========

// GetCFLocations 获取 CF 节点位置数据
func (s *Service) GetCFLocations() (interface{}, error) {
	filePath := filepath.Join(s.dataDir, "cf_locations.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取 CF 位置数据失败: %w", err)
	}

	var result interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析 CF 位置数据失败: %w", err)
	}
	return result, nil
}

// GetCFIPMapping 获取 CF IP 到数据中心映射
func (s *Service) GetCFIPMapping() (interface{}, error) {
	filePath := filepath.Join(s.dataDir, "cf_ip_dc_mapping.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取 CF IP 映射数据失败: %w", err)
	}

	var result interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析 CF IP 映射数据失败: %w", err)
	}
	return result, nil
}

// ScanCFIPs 扫描 CF IP
func (s *Service) ScanCFIPs() ([]CFIPScanResult, error) {
	// 读取已知的 CF IP 段
	ipv4Path := filepath.Join(s.dataDir, "cf", "ips-v4.txt")
	data, err := os.ReadFile(ipv4Path)
	if err != nil {
		return nil, fmt.Errorf("读取 CF IPv4 地址列表失败: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	ipList := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			ipList = append(ipList, line)
		}
	}

	// 返回 IP 列表（扫描在前端或独立工具中执行）
	results := make([]CFIPScanResult, 0, len(ipList))
	for _, ip := range ipList {
		results = append(results, CFIPScanResult{
			IP:       ip,
			Latency:  0,
			Location: "",
			DC:       "",
		})
	}

	// 按 IP 排序
	sort.Slice(results, func(i, j int) bool {
		return results[i].IP < results[j].IP
	})

	return results, nil
}

// ========== 辅助方法 ==========

// findAccount 查找账户（内部使用）
func (s *Service) findAccount(id string) (*CFAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 如果 id 为空，尝试获取默认账户
	if id == "" {
		for i, a := range s.accounts {
			if a.IsDefault {
				return &s.accounts[i], nil
			}
		}
		if len(s.accounts) > 0 {
			return &s.accounts[0], nil
		}
		return nil, fmt.Errorf("没有配置 Cloudflare 账户")
	}

	for i, a := range s.accounts {
		if a.ID == id {
			return &s.accounts[i], nil
		}
	}
	return nil, fmt.Errorf("账户不存在: %s", id)
}
