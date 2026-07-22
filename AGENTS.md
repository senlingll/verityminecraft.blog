# 项目级 Agent 规则

## 模板站页面风格规则

新增或修改内页时，必须复用首页的模板站视觉体系：

- 页面 body 使用 `img2grid-page`，内页可追加语义类，例如 `legal-page`、`guide-page`、`tool-page`。
- 优先复用 `static/css/site.css` 中已有的 header、footer、按钮、卡片、网格背景、内容面板样式。
- 禁止新增页面继续使用旧模板类名或旧配色，例如 `romestead-page`、`romestead-static-*`、`topbar-gradient`、`footer-gradient`、旧 Bootstrap navbar/footer 风格。
- 内页 header/footer 必须与首页保持一致，除非用户明确要求单独设计。
- 新增样式应追加到 `static/css/site.css`，并尽量复用现有 CSS 变量，例如 `--navy`、`--coral`、`--line`、`--muted`、`--shadow`。
- 如果新增页面需要独立布局，也必须在当前模板站品牌视觉体系内扩展，不得引入与首页不一致的旧站点模板配色。
