# sanjie-yikang11

三傑益康生技 3J Wellness Biotech 品牌網站（Astro 靜態站）。

```
pnpm install
pnpm dev       # 開發
pnpm verify    # 檢查＋建置＋測試
```

改版方式、設計規範、部署與 GSC／GA4 查詢見 `CLAUDE.md`。

內容網站基礎建設入口：[docs/content-foundation.md](docs/content-foundation.md)。

```
pnpm content             # 內容狀態（含草稿／排程）
pnpm content:check       # 格式、來源、關聯與圖片預檢
pnpm writer:import <file.json> --dry-run  # Writer 接稿預檢
pnpm verify:content      # 根路徑／子路徑與公開範圍整合驗證
pnpm insights            # 三傑 GSC／GA4 的內容成效回饋
```
