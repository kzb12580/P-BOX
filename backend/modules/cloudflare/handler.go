package cloudflare

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler Cloudflare API 处理器
type Handler struct {
	service *Service
	dataDir string
}

// NewHandler 创建处理器
func NewHandler(dataDir string) *Handler {
	return &Handler{
		service: NewService(dataDir),
		dataDir: dataDir,
	}
}

// RegisterRoutes 注册路由
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// CF 账户管理
	r.GET("/accounts", h.ListAccounts)
	r.POST("/accounts", h.CreateAccount)
	r.PUT("/accounts/:id", h.UpdateAccount)
	r.DELETE("/accounts/:id", h.DeleteAccount)
	r.GET("/accounts/:id/usage", h.GetAccountUsage)
	r.GET("/accounts/:id/usage/cached", h.GetCachedUsage)

	// Workers 管理
	r.GET("/workers", h.ListWorkers)
	r.GET("/workers/:name", h.GetWorker)
	r.POST("/workers", h.CreateWorker)
	r.PUT("/workers/:name", h.UpdateWorker)
	r.DELETE("/workers/:name", h.DeleteWorker)
	r.POST("/workers/:name/upload", h.UploadWorker)
	r.POST("/workers/:name/routes", h.BindWorkerRoute)
	r.GET("/workers/:name/variables", h.GetWorkerVariables)
	r.POST("/workers/:name/variables", h.SetWorkerVariables)

	// 路由管理
	r.GET("/routes", h.ListRoutes)
	r.DELETE("/routes/:id", h.DeleteRoute)

	// 域名 & Zones
	r.GET("/domains", h.ListDomains)
	r.GET("/zones", h.ListZones)

	// KV 命名空间管理
	r.GET("/kv/namespaces", h.ListKVNamespaces)
	r.POST("/kv/namespaces", h.CreateKVNamespace)
	r.DELETE("/kv/namespaces/:id", h.DeleteKVNamespace)
	r.PUT("/kv/namespaces/:id", h.RenameKVNamespace)
	r.GET("/kv/namespaces/:id/keys", h.ListKVKeys)
	r.GET("/kv/namespaces/:id/values/:key", h.GetKVValue)
	r.PUT("/kv/namespaces/:id/values/:key", h.SetKVValue)
	r.DELETE("/kv/namespaces/:id/keys/:key", h.DeleteKVKey)

	// ECH 部署管理
	r.GET("/ech-deployments", h.ListECHDeployments)
	r.POST("/ech-deployments", h.CreateECHDeployment)
	r.DELETE("/ech-deployments/:id", h.DeleteECHDeployment)

	// 配置 & 同步
	r.GET("/config", h.GetConfig)
	r.POST("/sync", h.SyncData)

	// CF IP 工具
	r.GET("/cfip/locations", h.GetCFLocations)
	r.GET("/cfip/mapping", h.GetCFIPMapping)
	r.POST("/cfip/scan", h.ScanCFIPs)

	// 工作模板
	r.GET("/templates", h.ListTemplates)
	r.GET("/templates/:name", h.GetTemplate)
}

// getAccountID 从查询参数获取账户 ID
func (h *Handler) getAccountID(c *gin.Context) string {
	return c.Query("accountId")
}

// ========== CF 账户管理 ==========

// ListAccounts 获取所有 CF 账户
func (h *Handler) ListAccounts(c *gin.Context) {
	accounts := h.service.ListAccounts()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    accounts,
	})
}

// CreateAccount 创建 CF 账户
func (h *Handler) CreateAccount(c *gin.Context) {
	var req CFAccountCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	account, err := h.service.CreateAccount(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    account,
	})
}

// UpdateAccount 更新 CF 账户
func (h *Handler) UpdateAccount(c *gin.Context) {
	id := c.Param("id")
	var req CFAccountUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	account, err := h.service.UpdateAccount(id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    account,
	})
}

// DeleteAccount 删除 CF 账户
func (h *Handler) DeleteAccount(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteAccount(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

// GetAccountUsage 获取账户使用量
func (h *Handler) GetAccountUsage(c *gin.Context) {
	id := c.Param("id")
	usage, err := h.service.GetAccountUsage(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    usage,
	})
}

// GetCachedUsage 获取缓存的使用量
func (h *Handler) GetCachedUsage(c *gin.Context) {
	id := c.Param("id")
	usage, err := h.service.GetCachedUsage(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "暂无缓存数据",
			"data":    nil,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    usage,
	})
}

// ========== Workers 管理 ==========

// ListWorkers 获取 Worker 列表
func (h *Handler) ListWorkers(c *gin.Context) {
	accountID := h.getAccountID(c)
	workers, err := h.service.ListWorkers(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    workers,
	})
}

// GetWorker 获取 Worker 脚本内容
func (h *Handler) GetWorker(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	worker, err := h.service.GetWorker(accountID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    worker,
	})
}

// CreateWorker 创建 Worker
func (h *Handler) CreateWorker(c *gin.Context) {
	accountID := h.getAccountID(c)

	var req WorkerCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.service.CreateWorker(accountID, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Worker 创建成功"})
}

// UpdateWorker 更新 Worker 脚本
func (h *Handler) UpdateWorker(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.service.UpdateWorker(accountID, name, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Worker 更新成功"})
}

// DeleteWorker 删除 Worker
func (h *Handler) DeleteWorker(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	if err := h.service.DeleteWorker(accountID, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Worker 删除成功"})
}

// UploadWorker 上传 Worker 文件
func (h *Handler) UploadWorker(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "上传文件错误: " + err.Error()})
		return
	}
	defer file.Close()

	_ = header
	fileContent, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": "读取文件失败: " + err.Error()})
		return
	}

	metadata := map[string]interface{}{
		"bindings": []interface{}{},
	}
	// 尝试从表单获取 metadata
	if metaStr := c.PostForm("metadata"); metaStr != "" {
		json.Unmarshal([]byte(metaStr), &metadata)
	}

	if err := h.service.UploadWorkerFiles(accountID, name, fileContent, metadata); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "Worker 上传成功"})
}

// BindWorkerRoute 绑定 Worker 到路由
func (h *Handler) BindWorkerRoute(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	var req WorkerRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.service.BindWorkerToRoute(accountID, name, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "路由绑定成功"})
}

// GetWorkerVariables 获取 Worker 环境变量
func (h *Handler) GetWorkerVariables(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	variables, err := h.service.GetWorkerVariables(accountID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    variables,
	})
}

// SetWorkerVariables 设置 Worker 环境变量
func (h *Handler) SetWorkerVariables(c *gin.Context) {
	accountID := h.getAccountID(c)
	name := c.Param("name")

	var req WorkerVariablesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.service.SetWorkerVariables(accountID, name, req.Variables); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "环境变量设置成功"})
}

// ========== 路由管理 ==========

// ListRoutes 获取所有路由
func (h *Handler) ListRoutes(c *gin.Context) {
	accountID := h.getAccountID(c)
	routes, err := h.service.ListRoutes(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    routes,
	})
}

// DeleteRoute 删除路由
func (h *Handler) DeleteRoute(c *gin.Context) {
	accountID := h.getAccountID(c)
	id := c.Param("id")

	if err := h.service.DeleteRoute(accountID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "路由删除成功"})
}

// ========== 域名 & Zones ==========

// ListDomains 获取自定义域名列表
func (h *Handler) ListDomains(c *gin.Context) {
	accountID := h.getAccountID(c)
	domains, err := h.service.ListDomains(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    domains,
	})
}

// ListZones 获取 Zone 列表
func (h *Handler) ListZones(c *gin.Context) {
	accountID := h.getAccountID(c)
	zones, err := h.service.ListZones(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    zones,
	})
}

// ========== KV 管理 ==========

// ListKVNamespaces 获取 KV 命名空间列表
func (h *Handler) ListKVNamespaces(c *gin.Context) {
	accountID := h.getAccountID(c)
	namespaces, err := h.service.ListKVNamespaces(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    namespaces,
	})
}

// CreateKVNamespace 创建 KV 命名空间
func (h *Handler) CreateKVNamespace(c *gin.Context) {
	accountID := h.getAccountID(c)

	var req KVCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	ns, err := h.service.CreateKVNamespace(accountID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "KV 命名空间创建成功",
		"data":    ns,
	})
}

// DeleteKVNamespace 删除 KV 命名空间
func (h *Handler) DeleteKVNamespace(c *gin.Context) {
	accountID := h.getAccountID(c)
	id := c.Param("id")

	if err := h.service.DeleteKVNamespace(accountID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "KV 命名空间删除成功"})
}

// RenameKVNamespace 重命名 KV 命名空间
func (h *Handler) RenameKVNamespace(c *gin.Context) {
	accountID := h.getAccountID(c)
	id := c.Param("id")

	var req KVRenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.service.RenameKVNamespace(accountID, id, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "KV 命名空间重命名成功"})
}

// ListKVKeys 列出 KV 键
func (h *Handler) ListKVKeys(c *gin.Context) {
	accountID := h.getAccountID(c)
	id := c.Param("id")
	prefix := c.Query("prefix")
	limit := 100
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "100")); err == nil && l > 0 {
		limit = l
	}

	keys, err := h.service.ListKVKeys(accountID, id, prefix, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    keys,
	})
}

// GetKVValue 获取 KV 值
func (h *Handler) GetKVValue(c *gin.Context) {
	accountID := h.getAccountID(c)
	nsID := c.Param("id")
	key := c.Param("key")

	value, err := h.service.GetKVValue(accountID, nsID, key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"key":   key,
			"value": value,
		},
	})
}

// SetKVValue 设置 KV 值
func (h *Handler) SetKVValue(c *gin.Context) {
	accountID := h.getAccountID(c)
	nsID := c.Param("id")
	key := c.Param("key")

	var req struct {
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// 尝试从原始 body 读取（纯文本）
		body, _ := io.ReadAll(c.Request.Body)
		req.Value = string(body)
	}

	if err := h.service.SetKVValue(accountID, nsID, key, req.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "KV 值设置成功"})
}

// DeleteKVKey 删除 KV 键
func (h *Handler) DeleteKVKey(c *gin.Context) {
	accountID := h.getAccountID(c)
	nsID := c.Param("id")
	key := c.Param("key")

	if err := h.service.DeleteKVKey(accountID, nsID, key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "KV 键删除成功"})
}

// ========== ECH 部署 ==========

// ListECHDeployments 获取 ECH 部署列表
func (h *Handler) ListECHDeployments(c *gin.Context) {
	deploys := h.service.ListECHDeployments()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    deploys,
	})
}

// CreateECHDeployment 创建 ECH 部署
func (h *Handler) CreateECHDeployment(c *gin.Context) {
	var req ECHCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误: " + err.Error()})
		return
	}

	deploy, err := h.service.CreateECHDeployment(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ECH 部署创建成功",
		"data":    deploy,
	})
}

// DeleteECHDeployment 删除 ECH 部署
func (h *Handler) DeleteECHDeployment(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteECHDeployment(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ECH 部署删除成功"})
}

// ========== 配置 & 同步 ==========

// GetConfig 获取 CF 模块配置
func (h *Handler) GetConfig(c *gin.Context) {
	config := h.service.GetConfig()
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    config,
	})
}

// SyncData 同步数据
func (h *Handler) SyncData(c *gin.Context) {
	accountID := h.getAccountID(c)

	result, err := h.service.SyncData(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": result.Message,
		"data":    result,
	})
}

// ========== CF IP 工具 ==========

// GetCFLocations 获取 CF 节点位置数据
func (h *Handler) GetCFLocations(c *gin.Context) {
	data, err := h.service.GetCFLocations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    data,
	})
}

// GetCFIPMapping 获取 CF IP 映射数据
func (h *Handler) GetCFIPMapping(c *gin.Context) {
	data, err := h.service.GetCFIPMapping()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    data,
	})
}

// ScanCFIPs 扫描 CF IP
func (h *Handler) ScanCFIPs(c *gin.Context) {
	results, err := h.service.ScanCFIPs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    results,
	})
}

// ========== 工作模板 ==========

// ListTemplates 列出可用模板
func (h *Handler) ListTemplates(c *gin.Context) {
	templateDir := filepath.Join(h.dataDir, "templates")
	entries, err := os.ReadDir(templateDir)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data":    []interface{}{},
		})
		return
	}

	templates := make([]map[string]interface{}, 0)
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".js" {
			continue
		}
		info, _ := entry.Info()
		templates = append(templates, map[string]interface{}{
			"name":     entry.Name(),
			"size":     info.Size(),
			"modified": info.ModTime(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    templates,
	})
}

// GetTemplate 获取模板内容
func (h *Handler) GetTemplate(c *gin.Context) {
	name := c.Param("name")
	// 防止路径遍历
	if name == "" || name == ".." || name == "." {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的模板名称"})
		return
	}

	templatePath := filepath.Join(h.dataDir, "templates", name)
	data, err := os.ReadFile(templatePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": fmt.Sprintf("模板不存在: %s", name)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"name":    name,
			"content": string(data),
		},
	})
}
