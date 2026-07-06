# 前端 Web Frontend

TanStack Start / Router 页面与 React 组件（`vite.config.ts` → `tanstackStart({ srcDirectory: "web" })`）。

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
