# sanjie-yikang11

三傑益康生技 3J Wellness Biotech 健康生活與營養內容站（Astro 靜態站），商品交易由獨立購物頁承接。

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
pnpm editorial list      # 查看草稿、送審與發布狀態
pnpm editorial publish <slug>  # 產生發布計畫，--write 才實際改檔
pnpm release:check       # 驗收本機產物
pnpm release:launch      # 檢查最低內容上線條件
```
