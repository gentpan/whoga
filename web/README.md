# 前端 Web Frontend

页面与 React 组件，源码在 `web/`（Vite 配置见根目录 `vite.config.ts`）。

## 技术栈

| 部分 | 说明 |
|------|------|
| **框架** | React 19 · TypeScript |
| **路由** | TanStack Router / Start |
| **交互** | Base UI（语言菜单、图表 Tooltip 等） |
| **样式** | `styles.css` 全局 CSS · Sora 字体 |
| **图标** | lucide-react |

Base UI 是无样式 headless 组件，外观由项目 CSS 控制，便于配合暗色主题和品牌色。

```
web/
├── routes/        # 页面路由（/, /whois/$query, /learn, /requests）
├── components/    # UI 组件
├── styles.css     # 全局样式
├── router.tsx     # 路由入口
└── routeTree.gen.ts
```

| 路径 | 说明 |
|------|------|
| `routes/` | 页面路由 |
| `components/` | UI 组件（首页、Learn、Requests） |
| `styles.css` | 全局样式 |
| `router.tsx` | 路由入口 |

静态资源（favicon、logo）在根目录 **`public/`**（Vite 约定，勿与 `web/` 混淆）。

本地开发：`pnpm dev` → http://localhost:3410

生成路由：`pnpm generate-routes`
