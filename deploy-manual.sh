#!/bin/bash

# P-BOX 手动部署脚本
# 适用于没有Release的情况

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║        P-BOX 手动部署脚本            ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 检查是否以root运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用sudo运行此脚本${NC}"
    exit 1
fi

# 安装依赖
echo -e "${BLUE}安装依赖...${NC}"
apt update
apt install -y golang-go nodejs npm git

# 克隆仓库
echo -e "${BLUE}克隆P-BOX仓库...${NC}"
git clone https://github.com/kzb12580/P-BOX.git
cd P-BOX

# 创建数据目录
mkdir -p data/configs data/cores data/logs

# 编译后端
echo -e "${BLUE}编译后端...${NC}"
cd backend
go mod tidy
go build -o p-box .
cd ..

# 安装前端依赖
echo -e "${BLUE}安装前端依赖...${NC}"
cd frontend
npm install
npm run build
cd ..

# 复制前端文件到后端目录
cp -r frontend/dist/* backend/data/

# 创建启动脚本
cat > /usr/local/bin/p-box << 'EOF'
#!/bin/bash
cd /root/P-BOX/backend
./p-box "$@"
EOF

chmod +x /usr/local/bin/p-box

# 创建systemd服务
cat > /etc/systemd/system/p-box.service << EOF
[Unit]
Description=P-BOX Proxy Management Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/P-BOX/backend
ExecStart=/root/P-BOX/backend/p-box
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable p-box
systemctl start p-box

echo -e "${GREEN}"
echo "══════════════════════════════════════════"
echo "P-BOX 部署完成！"
echo ""
echo "访问地址: http://服务器IP:8383"
echo "管理命令: systemctl status p-box"
echo "重启服务: systemctl restart p-box"
echo "查看日志: journalctl -u p-box -f"
echo "══════════════════════════════════════════"
echo -e "${NC}"

# 检查服务状态
sleep 3
echo -e "${YELLOW}检查服务状态...${NC}"
systemctl status p-box --no-pager