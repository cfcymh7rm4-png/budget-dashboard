#!/bin/bash

# 本地构建脚本 - 用于内存充足的环境构建后上传到平台
# 使用方法:
# 1. 在本机执行: ./build-local.sh
# 2. 将生成的 deploy.zip 上传到平台
# 3. 或直接将 dist/ 目录内容部署到服务器

set -e

echo "🚀 开始本地构建..."

# 清理旧构建
rm -rf dist node_modules/.cache

# 安装依赖
echo "📦 安装依赖..."
npm ci --no-audit --no-fund

# 构建客户端（4GB内存限制）
echo "🔨 构建客户端..."
NODE_OPTIONS='--max-old-space-size=4096' npm run build:client

# 构建服务端
echo "🔨 构建服务端..."
npm run build:server

echo "✅ 构建完成！"
echo ""
echo "📂 构建输出:"
echo "  - dist/client/    前端静态文件"
echo "  - dist/server/    服务端代码"
echo ""
echo "📦 打包命令（可选）:"
echo "  zip -r deploy.zip dist/ package.json package-lock.json"
