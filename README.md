# Photo to Anime Generator

A frontend-backend separated AI image generation project that converts ordinary photos into anime-style artwork.

## 🌍 Multi-language Support

This project supports multiple languages:
- **English** (en) - Default language
- **Español** (es) - Spanish

### 添加新语言

要添加新的语言支持，请按照以下步骤：

#### 1. 更新语言配置

Edit `app.py`, add new language code to `SUPPORTED_LANGUAGES` array:
```python
SUPPORTED_LANGUAGES = ['en', 'es', 'new_lang']
```

Edit `static/js/i18n-manager.js`, update frontend supported language list:
```javascript
: ['en', 'es', 'new_lang'];
```

#### 2. Create Translation Files

Create JSON translation files in the following directories:

**Common Translations** (Required):
```
templates/i18n/common/new_lang.json
```

**Page-specific Translations**:
```
templates/i18n/pages/index/new_lang.json        # Homepage
templates/i18n/pages/about/new_lang.json        # About page
templates/i18n/pages/method/new_lang.json       # Method description
templates/i18n/pages/my-orders/new_lang.json    # My orders
templates/i18n/pages/my-credits/new_lang.json   # My credits
templates/i18n/pages/api-keys/new_lang.json     # API keys
```

**Admin Interface Translations** (Optional):
```
templates/i18n/admin/new_lang.json
```

#### 3. Translation File Structure

Use `templates/i18n/common/en.json` as template, ensure including these key sections:

```json
{
  "seo": {
    "default_title": "Your SEO-optimized title (50-60 chars)",
    "default_description": "Your SEO description (150-160 chars)",
    "author": "Photo to Anime"
  },
  "brand": {
    "name": "Photo to Anime",
    "icon_alt": "Photo to Anime icon"
  },
  "nav": { ... },
  "auth": { ... },
  "footer": { ... }
}
```

#### 4. SEO Optimization Best Practices

Optimize search engine keywords for target language:

**西班牙语示例**:
- 主关键词: "foto a anime"
- 次要关键词: "convertir fotos a anime", "generador de anime AI"
- 标题长度: 50-60个字符
- 描述长度: 150-160个字符

#### 5. 测试新语言

运行以下命令测试语言支持：

```python
python -c "
from app import get_available_languages, load_common_data, load_page_data
print('Available languages:', get_available_languages())
print('Common data loaded:', load_common_data('new_lang').get('brand', {}).get('name'))
print('Index page loaded:', bool(load_page_data('index', 'new_lang')))
"
```

### URL结构

语言URL结构如下：
- 默认语言 (英语): `/`, `/about`, `/method`
- Spanish: `/es/`, `/es/about`, `/es/method`
- 新语言: `/new_lang/`, `/new_lang/about`, `/new_lang/method`

### 翻译文件位置

```
templates/i18n/
├── admin/              # Admin interface translations
│   ├── en.json
│   └── es.json
├── common/             # Common component translations (navigation, footer, SEO, etc.)
│   ├── en.json
│   └── es.json
└── pages/              # Page-specific translations
    ├── about/
    ├── api-keys/
    ├── index/          # Homepage
    ├── method/
    ├── my-credits/
    └── my-orders/
```

## 🛠 开发指南

### 前端 (Flask)
```bash
# 启动开发服务器
python app.py

# 构建静态站点
python build.py
```

### 后端 (Cloudflare Workers)
参见 `backend/README.md`

## 🌐 多语言工作流

### 添加新内容时的流程

1. 在英文版本中添加新的翻译键
2. 在所有语言文件中镜像相同的JSON结构
3. 为每种语言提供适当的翻译
4. 运行测试确保没有遗漏的翻译

### 推荐的翻译工具

如果项目规模扩大，考虑使用以下翻译管理工具：
- **Crowdin**: 协作翻译平台
- **POEditor**: 本地化管理工具
- **Weblate**: 开源翻译平台

## 📝 贡献指南

### 翻译贡献

欢迎贡献新语言的翻译！请确保：
- 翻译准确且符合目标语言习惯
- SEO标题和描述针对目标市场优化
- 保持JSON文件格式正确
- 测试所有翻译键是否正常工作

### 代码贡献

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 📄 许可证

[许可证信息]

## 🚀 部署

### 前端部署
静态文件生成后可以部署到任何静态托管服务。

### 后端部署
使用Cloudflare Workers部署，详见 `backend/README.md`。

---

**注意**: 当添加新的文本内容时，请确保在所有语言文件中添加相应的翻译键，以保持多语言支持的一致性。


commit 56a6e0809e5b28f3ce23d9cde139a2dd6309d769 (HEAD -> main)
Author: OFZFZS <1498066696@qq.com>
Date:   Thu Sep 25 22:18:40 2025 +0800

    修改本地开发环境
