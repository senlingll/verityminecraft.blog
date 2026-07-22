/**
 * D1 数据库迁移脚本
 * 使用 wrangler d1 命令进行数据库迁移
 */

import { spawn } from 'child_process';
import { loadWranglerEnv } from './load-env.js';

console.log('🗄️  ImgGenerator D1 数据库迁移工具\n');

// 1. 加载 wrangler.toml 中的环境变量
console.log('📋 正在加载环境变量...');
const vars = loadWranglerEnv();

// 2. 检查是否有 D1 数据库配置
console.log('🔗 正在检查 D1 数据库配置...');

// 3. 首先生成迁移文件
console.log('\n📋 正在生成迁移文件...');
const generateProcess = spawn('npx', ['drizzle-kit', 'generate'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

generateProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ 迁移文件生成完成！');
    console.log('\n📋 请手动运行以下命令来应用迁移:');
    console.log('wrangler d1 migrations apply imggen-database         # 生产环境');
  } else {
    console.log(`\n❌ 迁移文件生成失败，退出代码: ${code}`);
  }
  process.exit(code);
});

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n⏹️  正在取消迁移...');
  generateProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  正在取消迁移...');
  generateProcess.kill('SIGTERM');
}); 