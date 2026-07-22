# ImgGenerator Backend

基于 Cloudflare Workers + D1 数据库的图像生成服务后端 API。

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Wrangler CLI

### 安装依赖
```bash
npm install
```

### 开发
```bash
npm run dev
```

### 部署
```bash
npm run deploy
```

## 🗄️ 数据库

### 基本操作
```bash
# 生成迁移文件
npm run db:generate

# 应用迁移
npm run db:migrate

# 数据库交互
npm run db:shell
```

### 常用查询
```bash
# 查看所有表
wrangler d1 execute imggen-database --command "SELECT name FROM sqlite_master WHERE type='table'"

# 查询用户
wrangler d1 execute imggen-database --command "SELECT * FROM users LIMIT 5"

# 备份数据库
wrangler d1 export imggen-database --output=backup.sql

# 查看积分
wrangler d1 execute ageguesser-org --command "SELECT * FROM credits LIMIT 5"

# 设置积分
wrangler d1 execute ageguesser-org --command "update credits set credits=1000 where id=1"

node db-query.js "SELECT * FROM credits"
node db-query.js "update credits set credits=200"
node db-query.js "delete from  credits where id=2"
```

## 📁 项目结构

```
backend/
├── src/
│   ├── routes/          # API 路由
│   ├── auth.ts         # 认证逻辑
│   ├── db.ts           # 数据库连接
│   ├── schema.ts       # 数据库 Schema
│   └── index.ts        # 入口文件
├── drizzle/            # 数据库迁移文件
└── wrangler.toml       # Cloudflare 配置
```

## 🔧 配置

编辑 `wrangler.toml` 配置环境变量：

```toml
[vars]
JWT_SECRET = "your-jwt-secret"
OPENROUTER_API_KEY = "sk-or-v1-xxxxx"
```

## 📚 API 文档

主要端点：
- `GET /` - 健康检查
- `POST /auth/*` - 用户认证
- `POST /generate/*` - 图像生成（2 credits per request）
- `POST /openrouter/*` - 风格转换（2 credits per request）
- `GET /user/*` - 用户管理
- `POST /storage/*` - 文件存储
- `GET /credits/*` - 积分管理

## 💰 Credit费用

- **风格转换** (`/api/openrouter/style-transfer`): 2 credits
- **风格转换上传** (`/api/openrouter/style-transfer-upload`): 2 credits
- **Ghibli图像生成** (`/api/generate/ghibli-easycontrol`): 2 credits
- **新用户赠送**: 4 credits

---

💡 **提示**: 更多详细信息请查看源码或 Cloudflare Workers 文档。