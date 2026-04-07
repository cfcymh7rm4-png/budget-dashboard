#!/bin/bash

# 优化构建脚本 - 尽可能减少内存占用
# 由于无法修改 vite.config.ts，使用环境变量优化

set -e

echo "🚀 开始优化构建..."

# 清理
rm -rf dist node_modules/.cache .turbo

# 设置内存优化环境变量
export NODE_OPTIONS='--max-old-space-size=1536 --optimize-for-size'
export VITE_NODE_OPTIONS='--max-old-space-size=1536'

# 禁用 source map 减少内存
export VITE_SOURCEMAP=false

# 使用 CI 模式（更少日志，更少内存）
export CI=true

echo "📦 安装依赖（仅生产）..."
npm ci --omit=dev --no-audit --no-fund 2>/dev/null || npm ci --no-audit --no-fund

echo "🔨 构建客户端..."
# 分步骤构建，减少并发
NODE_ENV=production npx vite build --config vite.config.ts --emptyOutDir

echo "✅ 构建完成！"
