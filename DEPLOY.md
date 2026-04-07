# 本地构建部署指南

## 问题背景

由于平台构建环境内存限制（2GB），而项目构建需要约 3GB 内存，需要在本地构建后上传。

## 解决方案

### 方案 A: 使用构建脚本（推荐）

1. **在本机执行构建**
   ```bash
   ./build-local.sh
   ```

2. **打包构建产物**
   ```bash
   zip -r deploy.zip dist/ package.json
   ```

3. **上传到平台部署**

### 方案 B: 手动构建

```bash
# 1. 清理
rm -rf dist node_modules/.cache

# 2. 安装依赖
npm ci

# 3. 构建（需要 4GB 内存）
NODE_OPTIONS='--max-old-space-size=4096' npm run build

# 4. 打包
cp package.json dist/
zip -r deploy.zip dist/
```

## 环境要求

- Node.js >= 22.0.0
- 内存 >= 4GB
- npm 或 pnpm

## 构建输出

构建完成后会在 `dist/` 目录生成：
- `dist/client/` - 前端静态资源
- `dist/server/` - NestJS 服务端代码

## 常见问题

### Q: 为什么需要本地构建？
A: 项目使用了 Tailwind CSS v4 和大量 Radix UI 组件，构建时需要处理 4000+ 模块，内存占用较大。

### Q: 能减少内存占用吗？
A: 已尽可能精简（删除了富文本编辑器、未使用的图表库等），但核心依赖仍需 3GB+ 内存。

### Q: 如何联系平台增加内存？
A: 向平台反馈："项目构建需要 3GB 内存，当前 2GB 限制导致构建失败"
