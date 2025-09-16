# AppStore 用户评价自动分析系统

一个基于 Next.js 的网页应用，支持自动抓取 AppStore 应用的用户评价，调用大模型分析情感和问题，发现产品改进和新需求点，并支持一键生成分析报告和需求文档。

## 🚀 功能特性

- **应用管理**: 添加、编辑、删除要分析的 AppStore 应用
- **评论抓取**: 自动从 AppStore RSS API 抓取用户评论
- **智能分析**: 使用 Moonshot Kimi API 分析评论情感、问题和建议
- **数据可视化**: 多维度图表展示分析结果
- **报告生成**: 支持 Markdown、HTML、摘要格式的分析报告导出
- **Prompt 管理**: 可配置的分析 Prompt 模板，支持版本管理
- **定时任务**: 支持 Vercel Cron Job 自动抓取和分析
- **多存储支持**: 本地 JSON 文件、Vercel KV、Supabase 自动切换

## 🛠 技术栈

- **前端框架**: Next.js 15 + TypeScript
- **样式库**: TailwindCSS
- **图表库**: Recharts
- **数据存储**: 本地 JSON / Vercel KV / Supabase
- **AI 服务**: Moonshot Kimi API
- **部署平台**: Vercel

## 📦 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd app-review-cool
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

复制环境变量模板：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，配置必要的环境变量：

```env
# Moonshot Kimi API 配置（必需）
MOONSHOT_API_KEY=your_moonshot_api_key_here

# 存储配置（可选，默认使用本地 JSON 文件）
# Vercel KV 配置
KV_URL=your_vercel_kv_url
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_vercel_kv_read_only_token

# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 启动开发服务器

```bash
# 默认端口 3000
npm run dev

# 指定端口启动
npm run dev:4000  # 端口 4000
npm run dev:5000  # 端口 5000
npm run dev:6000  # 端口 6000

# 使用管理脚本启动
./scripts/dev-manager.sh start 4000
```

访问对应端口查看应用：
- [http://localhost:3000](http://localhost:3000) - 默认端口
- [http://localhost:4000](http://localhost:4000) - 推荐端口

## 🔧 多项目开发

### 端口管理

为避免与其他项目冲突，本项目支持多端口开发：

| 端口 | 用途 | 启动命令 |
|------|------|----------|
| 3000 | 默认 Next.js 项目 | `npm run dev:3000` |
| 4000 | AppStore 评论分析系统 | `npm run dev:4000` |
| 5000 | 其他 React/Vue 项目 | `npm run dev:5000` |
| 6000 | 备用端口 | `npm run dev:6000` |

### 开发管理脚本

使用内置的开发管理脚本：

```bash
# 查看帮助
./scripts/dev-manager.sh help

# 查看端口状态
./scripts/dev-manager.sh status

# 启动指定端口的服务
./scripts/dev-manager.sh start 4000

# 停止指定端口的服务
./scripts/dev-manager.sh stop 4000

# 切换环境配置
./scripts/dev-manager.sh env 4000
```

### 环境配置

不同端口使用不同的环境配置文件：

- `.env.development` - 开发环境模板
- `.env.port4000` - 端口 4000 专用配置
- `.env.local` - 当前激活的配置

### VS Code 工作区

使用 `app-review-cool.code-workspace` 文件可以：

- 在不同终端面板启动不同端口的服务
- 使用预配置的调试配置
- 快速切换项目任务

## 🔧 环境变量说明

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MOONSHOT_API_KEY` | Moonshot Kimi API 密钥 | `sk-xxx` |

### 可选配置

#### Vercel KV 存储

| 变量名 | 说明 |
|--------|------|
| `KV_URL` | Vercel KV 连接 URL |
| `KV_REST_API_URL` | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Vercel KV REST API Token |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV 只读 Token |

#### Supabase 存储

| 变量名 | 说明 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 |

## 📱 使用指南

### 1. 添加应用

1. 点击"添加应用"按钮
2. 输入应用名称、AppStore ID 和国家代码
3. 保存应用配置

### 2. 抓取评论

1. 在应用卡片中点击"抓取评论"
2. 系统会自动从 AppStore RSS API 获取最新评论
3. 支持增量抓取，避免重复数据

### 3. 分析评论

1. 点击"分析评论"开始 AI 分析
2. 系统会调用 Moonshot Kimi API 分析情感、问题和建议
3. 支持批量分析和单条分析

### 4. 查看结果

1. 点击"查看评论"浏览详细评论列表
2. 点击"查看分析"查看可视化分析结果
3. 支持多维度数据筛选和排序

### 5. 生成报告

1. 在分析页面点击"显示报告预览"
2. 选择报告格式（Markdown/HTML/摘要）
3. 预览并下载分析报告

### 6. 配置 Prompt

1. 点击"Prompt 配置"进入管理页面
2. 创建、编辑、测试 Prompt 模板
3. 激活不同的 Prompt 用于分析

## 🚀 部署到 Vercel

### 1. 连接 GitHub

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 中导入项目

### 2. 配置环境变量

在 Vercel 项目设置中添加环境变量：

- `MOONSHOT_API_KEY`: Moonshot Kimi API 密钥

### 3. 配置定时任务（可选）

在项目根目录创建 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/analyze",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

### 4. 部署

```bash
npm run build
```

或直接在 Vercel 中部署。

## 📊 数据存储

系统支持三种存储方式，会自动根据环境选择：

1. **本地 JSON 文件** (开发环境默认)
   - 数据存储在 `src/data/` 目录
   - 适合本地开发和测试

2. **Vercel KV** (生产环境推荐)
   - 基于 Redis 的键值存储
   - 适合 Vercel 部署环境

3. **Supabase** (可选)
   - PostgreSQL 数据库
   - 适合需要复杂查询的场景

## 🔄 API 接口

### 应用管理

- `GET /api/apps` - 获取应用列表
- `POST /api/apps` - 创建应用
- `PUT /api/apps/[id]` - 更新应用
- `DELETE /api/apps/[id]` - 删除应用

### 评论管理

- `GET /api/apps/[id]/reviews` - 获取评论列表
- `POST /api/apps/[id]/fetch` - 抓取评论
- `POST /api/apps/[id]/analyze` - 分析评论

### 分析结果

- `GET /api/apps/[id]/analysis` - 获取分析结果
- `POST /api/apps/[id]/generate-analysis` - 生成聚合分析
- `GET /api/apps/[id]/export-report` - 导出报告

### Prompt 管理

- `GET /api/prompts` - 获取 Prompt 模板
- `POST /api/prompts` - 创建 Prompt 模板
- `PUT /api/prompts/[id]` - 更新 Prompt 模板
- `DELETE /api/prompts/[id]` - 删除 Prompt 模板
- `POST /api/prompts/[id]/activate` - 激活 Prompt 模板

## 🐛 故障排除

### 常见问题

1. **Moonshot API 调用失败**
   - 检查 API 密钥是否正确
   - 确认账户余额充足
   - 检查网络连接

2. **评论抓取失败**
   - 确认 AppStore ID 正确
   - 检查国家代码格式
   - 验证应用在对应国家的 AppStore 中存在

3. **存储连接失败**
   - 检查环境变量配置
   - 确认存储服务可用性
   - 查看控制台错误日志

### 日志查看

开发环境：
```bash
npm run dev
```

生产环境：
- 查看 Vercel 函数日志
- 检查浏览器控制台

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请：

1. 查看 [Issues](../../issues) 页面
2. 创建新的 Issue
3. 联系项目维护者

---

**注意**: 本项目仅用于学习和研究目的，请遵守相关服务的使用条款。
