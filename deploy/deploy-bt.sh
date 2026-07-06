#!/bin/bash
# ============================================================
# whoga 宝塔面板一键部署脚本
# 适用于：Ubuntu/Debian + 宝塔面板
# 使用方法：以 root 身份运行 ./deploy/deploy-bt.sh
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
SITE_DIR="/www/wwwroot/whoga"
REPO_URL="https://github.com/gentpan/whoga.git"
PM2_NAME="whoga"
NODE_VERSION="20"

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 root 权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检查宝塔面板
check_bt() {
    if [ ! -f "/etc/init.d/bt" ]; then
        log_warn "未检测到宝塔面板，请先安装"
        log_info "安装命令: wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh ed8484bec"
        exit 1
    fi
    log_info "宝塔面板已安装 ✓"
}

# 安装 Node.js
install_node() {
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_NODE" -ge "20" ]; then
            log_info "Node.js $(node -v) 已安装 ✓"
            return
        fi
    fi

    log_info "安装 Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
    log_info "Node.js $(node -v) 安装完成 ✓"
}

# 安装 PM2
install_pm2() {
    if command -v pm2 &> /dev/null; then
        log_info "PM2 已安装 ✓"
        return
    fi

    log_info "安装 PM2..."
    npm install -g pm2 > /dev/null 2>&1
    log_info "PM2 安装完成 ✓"
}

# 部署项目
deploy_project() {
    log_info "开始部署 whoga..."

    # 创建目录
    mkdir -p $SITE_DIR

    if [ -d "$SITE_DIR/.git" ]; then
        log_info "更新代码..."
        cd $SITE_DIR
        git pull origin main
    else
        log_info "克隆代码..."
        rm -rf $SITE_DIR
        git clone $REPO_URL $SITE_DIR
        cd $SITE_DIR
    fi

    # 安装依赖
    log_info "安装依赖（可能需要几分钟）..."
    npm install

    # 构建
    log_info "构建项目..."
    npm run build

    # PM2 管理
    log_info "启动服务..."
    pm2 delete $PM2_NAME 2>/dev/null || true
    pm2 start npm --name $PM2_NAME -- start
    pm2 save
    pm2 startup

    log_info "服务已启动 ✓"
}

# 防火墙配置
config_firewall() {
    log_info "配置防火墙..."

    # 宝塔防火墙放行 3000 端口（内部使用）
    if command -v bt &> /dev/null; then
        bt 13 3000 2>/dev/null || true
    fi

    # UFW 防火墙
    if command -v ufw &> /dev/null; then
        ufw allow 3000/tcp 2>/dev/null || true
    fi

    log_info "防火墙配置完成 ✓"
}

# 显示完成信息
show_success() {
    echo ""
    echo "========================================"
    log_info "部署成功！"
    echo "========================================"
    echo ""
    echo -e "${GREEN}项目路径:${NC} $SITE_DIR"
    echo -e "${GREEN}本地端口:${NC} http://localhost:3000"
    echo ""
    echo -e "${YELLOW}下一步（宝塔面板）:${NC}"
    echo "1. 登录宝塔面板"
    echo "2. 网站 → 添加站点"
    echo "3. 配置反向代理: http://127.0.0.1:3000"
    echo "4. 申请 SSL 证书"
    echo ""
    echo -e "${YELLOW}常用命令:${NC}"
    echo "查看状态: pm2 status"
    echo "查看日志: pm2 logs whoga"
    echo "重启服务: pm2 restart whoga"
    echo "更新部署: cd $SITE_DIR && git pull && npm install && npm run build && pm2 restart whoga"
    echo ""
}

# 主流程
main() {
    echo "========================================"
    echo "   whoga 宝塔面板一键部署脚本"
    echo "========================================"
    echo ""

    check_root
    check_bt
    install_node
    install_pm2
    deploy_project
    config_firewall
    show_success
}

# 运行
main
