# 本地构建部署指南

## 问题背景

由于平台构建环境内存限制（2GB），而项目构建需要约 3GB 内存，需要在本地构建后上传。

**限制说明**：`package.json` 和 `vite.config.ts` 为平台锁定文件，无法修改。因此无法使用 SWC 替代 Babel 等优化方案。

## 解决方案

### 方案 A: 本地构建后上传（推荐）

1. **在本机执行构建**（需要 4GB+ 内存）
   ```bash
   ./build-local.sh
   ```

2. **打包构建产物**
   ```bash
   zip -r deploy.zip dist/ package.json
   ```

3. **上传到平台部署**

### 方案 B: 联系平台增加内存

向平台技术支持反馈：
> "项目构建需要 3GB 内存，当前 2GB 限制导致 JavaScript heap out of memory 错误"

### 方案 C: 使用轻量模板

如果以上方案都不可行，建议：
1. 创建新的轻量级项目
2. 仅使用必要依赖（不使用 Tailwind v4 + Radix UI 全套）
3. 手动迁移业务代码

## 环境要求

- Node.js >= 22.0.0
- 内存 >= 4GB
- npm 或 pnpm

## 构建输出

构建完成后会在 `dist/` 目录生成：
- `dist/client/` - 前端静态资源
- `dist/server/` - NestJS 服务端代码

## 已做的优化

- ✅ 删除未使用的富文本编辑器（tiptap + shiki）
- ✅ 删除未使用的图表库（recharts）
- ✅ 删除动画库（framer-motion, gsap）
- ✅ 删除状态管理（redux）
- ✅ 删除示例页面
- ✅ 卸载 400+ 个无用依赖

**剩余核心依赖**（无法删除）：
- Tailwind CSS v4（内存大户）
- 32 个 Radix UI 组件
- ECharts 图表库
- @lark-apaas 平台组件库

## 常见问题

### Q: 为什么不能直接修改 vite.config.ts 使用 SWC？
A: 平台锁定核心配置文件，无法修改。

### Q: 能减少内存占用吗？
A: 已尽可能精简，但核心框架仍需 3GB+ 内存。

### Q: 本地构建后如何部署？
A: 将 `dist/` 目录和 `package.json` 打包上传，或联系平台支持静态部署。
