#!/usr/bin/env node
// 容器启动入口文件
// 切换到 dist 目录并启动服务端

const path = require('path');

// 切换到 dist 目录，确保工作目录与 dev 模式一致
process.chdir(path.join(__dirname, 'dist'));
process.env.NODE_ENV = 'production';

// 启动服务端
require('./server/main.js');
