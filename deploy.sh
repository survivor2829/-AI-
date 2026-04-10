#!/bin/bash
# 快速部署脚本 — 仅同步代码，不重建镜像
# 用法: ssh 到服务器后执行，或本地 ssh 远程执行
#
# 场景1（服务器上执行）: cd /your/project && git pull && bash deploy.sh
# 场景2（本地执行）:     bash deploy.sh remote user@your-server-ip /path/to/project

set -e

# ============ 配置 ============
CONTAINER_NAME="clean-industry-ai-assistant-web-1"  # docker compose ps 查看实际名称
PROJECT_DIR="."
# ==============================

if [ "$1" = "remote" ]; then
    # 远程模式：从本地 rsync 到服务器，然后重启
    SERVER="$2"
    REMOTE_DIR="$3"
    if [ -z "$SERVER" ] || [ -z "$REMOTE_DIR" ]; then
        echo "用法: bash deploy.sh remote user@ip /remote/project/path"
        exit 1
    fi
    echo ">>> 同步代码到服务器..."
    rsync -avz --delete \
        --exclude='.git' --exclude='__pycache__' --exclude='static/uploads' \
        --exclude='static/outputs' --exclude='.env' --exclude='node_modules' \
        --exclude='.claude' --exclude='.omc' \
        . "$SERVER:$REMOTE_DIR/"
    echo ">>> 重启容器..."
    ssh "$SERVER" "cd $REMOTE_DIR && docker compose restart web"
    echo ">>> 部署完成!"
    exit 0
fi

# 本地模式：在服务器上直接执行
echo ">>> 复制更新的代码到容器..."
docker cp app.py "$CONTAINER_NAME":/app/app.py
docker cp templates/. "$CONTAINER_NAME":/app/templates/
docker cp static/. "$CONTAINER_NAME":/app/static/ 2>/dev/null || true

echo ">>> 重启容器..."
docker compose restart web

echo ">>> 部署完成! 耗时约 5-10 秒"
echo ">>> 查看日志: docker compose logs -f web"
