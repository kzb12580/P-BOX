package docker

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler Docker管理 API 处理器
type Handler struct {
	service *Service
}

// NewHandler 创建处理器
func NewHandler() *Handler {
	return &Handler{
		service: NewService(),
	}
}

// RegisterRoutes 注册路由
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/containers", h.ListContainers)
	r.POST("/containers/:id/start", h.StartContainer)
	r.POST("/containers/:id/stop", h.StopContainer)
	r.POST("/containers/:id/restart", h.RestartContainer)
	r.DELETE("/containers/:id", h.RemoveContainer)
	r.GET("/containers/:id/logs", h.GetContainerLogs)
	r.GET("/containers/:id/stats", h.GetContainerStats)
	r.GET("/images", h.ListImages)
	r.DELETE("/images/:id", h.RemoveImage)
	r.POST("/images/pull", h.PullImage)
	r.GET("/system/info", h.GetSystemInfo)
}

// ListContainers 获取所有容器列表
func (h *Handler) ListContainers(c *gin.Context) {
	all := c.Query("all") == "true"
	containers, err := h.service.ListContainers(all)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": containers})
}

// StartContainer 启动容器
func (h *Handler) StartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.StartContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// StopContainer 停止容器
func (h *Handler) StopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.StopContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// RestartContainer 重启容器
func (h *Handler) RestartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.RestartContainer(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// RemoveContainer 删除容器
func (h *Handler) RemoveContainer(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.service.RemoveContainer(id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// GetContainerLogs 获取容器日志
func (h *Handler) GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	tail := 100
	if t, err := strconv.Atoi(c.DefaultQuery("tail", "100")); err == nil && t > 0 {
		tail = t
	}
	logs, err := h.service.GetContainerLogs(id, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": logs})
}

// GetContainerStats 获取容器资源统计
func (h *Handler) GetContainerStats(c *gin.Context) {
	id := c.Param("id")
	stats, err := h.service.GetContainerStats(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": stats})
}

// ListImages 获取所有镜像列表
func (h *Handler) ListImages(c *gin.Context) {
	images, err := h.service.ListImages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": images})
}

// RemoveImage 删除镜像
func (h *Handler) RemoveImage(c *gin.Context) {
	id := c.Param("id")
	force := c.Query("force") == "true"
	if err := h.service.RemoveImage(id, force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// PullImage 拉取镜像
func (h *Handler) PullImage(c *gin.Context) {
	var req struct {
		Image string `json:"image" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}
	if err := h.service.PullImage(req.Image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": nil})
}

// GetSystemInfo 获取Docker系统信息
func (h *Handler) GetSystemInfo(c *gin.Context) {
	info, err := h.service.GetSystemInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success", "data": info})
}

// helper to drain and close response body
func drainAndClose(resp *http.Response) {
	if resp != nil {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}
