<div align="center">

# 🚀 P-BOX AI重建版

**AI重建的现代跨平台代理管理面板**

基于Mihomo核心 | 优雅Web界面 | 一键部署

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org)
[![AI Rebuilt](https://img.shields.io/badge/AI-Rebuilt-FF6B6B)](AI-REBUILD.md)

<img src="frontend/public/p-box-logo.png" width="120" alt="P-BOX Logo">

</div>

---

## ✨ Features

- 🎨 **Modern UI** - Beautiful Apple Glass style design with dark/light themes
- ��️ **Cross-Platform** - Supports macOS, Windows, Linux (**OpenWrt NOT supported**)
- 🔧 **System Proxy** - Auto-configure system proxy (macOS/Windows), no manual setup needed
- 📊 **Real-time Dashboard** - Traffic stats, connection monitoring, exit IP display
- 📦 **Subscription Management** - Multiple subscription sources with one-click update
- �� **Core Management** - Auto version detection, one-click download and install
- ⚡ **Config Generator** - Visual rule configuration with smart routing
- 🌐 **i18n** - Chinese/English language support
- 🔐 **Authentication** - Built-in login system to protect the panel

## 📸 Screenshots

### Dashboard
Real-time throughput, traffic stats, DNS statistics, traffic ranking, route stats, and system info.

![Dashboard](https://raw.githubusercontent.com/p-box2025/P-BOX/main/1.png)

### Core Management
Manage Mihomo and Sing-box cores, version detection, one-click install and switch.

![Core Management](https://raw.githubusercontent.com/p-box2025/P-BOX/main/2.png)

### Sing-box Config
Advanced configuration: DNS, traffic routing, rulesets, TLS, NTP, TUN settings and more.

![Sing-box Config](https://raw.githubusercontent.com/p-box2025/P-BOX/main/3.png)

### Traffic History
Traffic trend charts, upload/download statistics, and traffic classification.

![Traffic History](https://raw.githubusercontent.com/p-box2025/P-BOX/main/4.png)

## 🚀 快速开始

### Linux 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/kzb12580/P-BOX/main/install.sh | sudo bash
```

脚本将自动：
- 检测系统架构（amd64/arm64）
- 下载最新稳定版本
- 安装到 `/etc/p-box`
- 在端口 **8383** 启动P-BOX

### 手动安装

从[发布页面](https://github.com/kzb12580/P-BOX/releases)下载预编译二进制文件：

| 平台 | 文件 |
|:---|:---|
| Linux x64 | `p-box-linux-amd64.tar.gz` |
| Linux ARM64 | `p-box-linux-arm64.tar.gz` |

```bash
# 解压并运行
tar -xzf p-box-*.tar.gz
cd p-box-*
./p-box
```

访问 http://localhost:8383 访问面板。

### 本地开发

要运行源代码或参与开发：

#### 📋 前置要求
- **Go** 1.21 或更高版本
- **Node.js** 18 或更高版本

#### 🔨 逐步设置
1. **克隆仓库：**
   ```bash
   git clone https://github.com/kzb12580/P-BOX.git
   cd P-BOX
   ```

2. **初始化数据目录：**
   ```bash
   mkdir -p data/configs data/cores data/logs
   ```

3. **设置后端：**
   ```bash
   cd backend
   go mod tidy
   go build -o p-box .
   cd ..
   ```

4. **设置前端：**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

#### 🚀 运行应用
使用提供的启动脚本：
```bash
chmod +x start-all.sh
./start-all.sh
```

- **前端**: http://localhost:5173
- **后端**: http://localhost:8383

## 📁 Project Structure

```
p-box/
├── backend/                 # Go Backend
│   ├── main.go              # Entry point
│   ├── server/              # HTTP server
│   ├── modules/             # Feature modules
│   └── data/                # Runtime data
├── frontend/                # React Frontend
│   ├── src/                 # Source code
│   └── public/              # Static assets
├── data/                    # App data (configs, cores, rules)
├── build.sh                 # Multi-platform build script
├── install.sh               # Linux installer script
└── start-all.sh             # Development startup script
```

## 🛠️ Tech Stack

| Backend | Frontend |
|:---:|:---:|
| Go 1.21+ | React 18 |
| Gin | Vite 5 |
| WebSocket | TypeScript |
| YAML | Tailwind CSS |
| | Zustand |
| | i18next |

## ⚙️ Configuration

A default configuration file `data/config.yaml` is generated on the first run:

```yaml
# Server port (Linux default: 8666, others: 8383)
port: 8383

# Proxy port
mixedPort: 7890

# API secret (optional)
secret: ""

# Transparent proxy mode: off, tun, tproxy
transparentMode: "off"
```

## 🤝 贡献

欢迎提交Pull Requests和Issues！

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m "添加新功能"`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 📜 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 致谢

感谢原项目作者**dl185**的开源贡献。本项目通过AI技术成功重建了被删除的P-BOX项目。

- [Mihomo](https://github.com/MetaCubeX/mihomo) - 高性能代理核心
- [Clash](https://github.com/Dreamacro/clash) - 原始Clash核心
- [Sing-box](https://github.com/SagerNet/sing-box) - 通用代理平台
- [React](https://react.dev) - 前端框架
- [Tailwind CSS](https://tailwindcss.com) - CSS框架

---

<div align="center">

**如果本项目对您有帮助，请给它一个 ⭐️ Star！**

</div>
