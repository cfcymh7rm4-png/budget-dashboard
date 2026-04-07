#!/usr/bin/env node
// 容器启动入口文件

process.env.NODE_ENV = 'production';

// 直接启动服务端，不切换工作目录
// 让 main.ts 中的 process.cwd() 保持为项目根目录
require('./dist/server/main.js');
