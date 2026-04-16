package vpn

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

type VPNHandler struct {
	service *VPNService
}

func NewHandler(svc *VPNService) *VPNHandler {
	return &VPNHandler{
		service: svc,
	}
}

// RegisterRoutes 注册路由
func (h *VPNHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// VPN状态
	rg.GET("/status", h.GetStatus)
	// VPN连接
	rg.POST("/connect", h.Connect)
	// VPN断开
	rg.POST("/disconnect", h.Disconnect)
	// Cloudflare Workers脚本
	rg.GET("/cloudflare-script", h.GetCloudflareScript)
	rg.POST("/cloudflare-script", h.UpdateCloudflareScript)
}

// GetStatus 获取VPN连接状态
func (h *VPNHandler) GetStatus(c *gin.Context) {
	status, err := h.service.GetStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
	})
}

// Connect 建立VPN连接
func (h *VPNHandler) Connect(c *gin.Context) {
	var req struct {
		Server   string `json:"server" binding:"required"`
		Username string `json:"username"`
		Password string `json:"password"`
		Protocol string `json:"protocol"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 设置默认值
	if req.Protocol == "" {
		req.Protocol = "sstp"
	}
	if req.Username == "" {
		req.Username = "vpn"
	}

	result, err := h.service.Connect(req.Server, req.Username, req.Password, req.Protocol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "VPN连接已建立",
		"details": result,
	})
}

// Disconnect 断开VPN连接
func (h *VPNHandler) Disconnect(c *gin.Context) {
	err := h.service.Disconnect()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "VPN连接已断开",
	})
}

// GetCloudflareScript 获取Cloudflare Workers脚本
func (h *VPNHandler) GetCloudflareScript(c *gin.Context) {
	script, err := h.service.GetCloudflareScript()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"script": script,
	})
}

// UpdateCloudflareScript 更新Cloudflare Workers脚本
func (h *VPNHandler) UpdateCloudflareScript(c *gin.Context) {
	var req struct {
		Script string `json:"script" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	err := h.service.UpdateCloudflareScript(req.Script)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cloudflare脚本已更新",
	})
}