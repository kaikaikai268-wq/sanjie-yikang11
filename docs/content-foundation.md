# 內容網站基礎建設

此文件說明維護入口與驗收方式。文章數、測試數、流量與部署狀態以指令輸出為準。

## 能力與維護位置

| 能力 | 位置 | 驗證 |
|---|---|---|
| 文章、作者、專題共用資料契約 | `src/content.schemas.mjs`、`src/content.config.ts` | `pnpm content:check` |
| 台北日期、草稿與排程公開範圍 | `src/lib/content-core.mjs`、`src/lib/content.ts` | `pnpm test`、`pnpm verify:content` |
| 文章、分類、分頁、專題、作者頁 | `src/pages/{articles,topics,authors}`、`src/layouts/Article.astro` | `pnpm verify`、`pnpm verify:content` |
| 全文搜尋 | `src/pages/search.astro`、`scripts/postbuild.mjs` | 建置後在 `/search/` 實際搜尋 |
| Canonical、實體圖、文章 JSON-LD、OG | `src/layouts/Base.astro`、`src/lib/seo.ts`、文章版型 | 型別與建置測試、檢查 HTML |
| RSS、純文字、LLM 與讀者索引 | `src/pages/{rss.xml,llms.txt,llms-full.txt,reader-index.json}.ts` | `pnpm verify:content` |
| 響應式圖片 | `scripts/prepare-media.mjs`、`scripts/lib/rehype-content.mjs` | `pnpm media:prepare`、整合驗證 |
| 閱讀與購物點擊 | `src/lib/reading-client.ts`、`src/layouts/Base.astro` | 事件測試與正式 GA4 即時報表 |
| 搜尋／閱讀成效回饋 | `scripts/insights.mjs` | `pnpm insights` 或 `--input` 離線快照 |
| Writer 站端接稿 | `scripts/content.mjs import` | `pnpm writer:import <file.json> --dry-run` |
| 編輯送審、發布與排程 | `scripts/editorial.mjs` | `pnpm editorial list`、`pnpm editorial readiness <slug>` |
| 發布產物與線上驗收 | `scripts/release-check.mjs`、`dist/build-info.json` | `pnpm release:check`、`pnpm release:launch` |
| 編輯與關係說明 | `/editorial-policy/`、`/disclosure/`、`/privacy/` | 依實際營運變動同步修正 |

內容流程見 [content-publishing.md](content-publishing.md)，編輯發布見 [editorial-workflow.md](editorial-workflow.md)，前台見 [content-pages.md](content-pages.md)，搜尋、分析與事件見 [analytics-content.md](analytics-content.md)，發布驗收見 [release-runbook.md](release-runbook.md)。

## 建置與發布

`pnpm build` 透過 `scripts/build.mjs` 在同一次建置固定 `CONTENT_BUILD_TIME`，然後依序執行內容預檢、媒體準備、Astro 建置與索引整理。所有公開輸出使用相同時點，避免排程稿在建置途中到期而讓圖片、路由與索引不一致。開發一般不用設定此變數；重現歷史建置時才明確指定帶時區 ISO 日期。

`pnpm verify` 另包含 Astro 型別檢查與所有 Node 測試。`pnpm verify:content` 暫時建立測試文章、隱藏狀態、專題與圖片，驗證正式模式下根路徑及子路徑；完成或失敗後移除暫存來源，重建不含測試資料的預覽輸出。不要與其他建置同時執行。

GitHub Actions 沿用 main push／PR 檢查，另在每小時第 17 分鐘排程重建。文章只在到期後下一次成功建置公開；GitHub 排程可能延遲。main push 會部署，功能分支與 PR 不會直接部署正式站。

## 媒體

封面、作者圖片與 Markdown 內文圖片都使用本機 `public/content/`、`public/images/` 或 `public/covers/` 來源；不接受遠端圖片或帶 query 的圖片網址。`media:prepare` 依來源尺寸產生響應式 WebP 與尺寸資訊，不放大原圖；保留原圖。只清理由本工具產生且 manifest 不再引用的 hash 圖片，不刪使用者原圖。

`src/data/content-images.json`、`public/media/content/` 與 `public/og/default.png` 為可重建輸出，不提交。`pnpm dev`／`pnpm check`／`pnpm build` 會先準備必要媒體。原有站台圖片繼續使用 Astro 圖片服務，字型沿用既有 Google Fonts，尚未搬入其他網站的字型子集化流程。

放進 `public/` 的原始圖片本身就是公開資產；草稿不產生公開文字頁面，不代表 `public/` 內資產具備私密權限。私密素材不要放進 public 或公開 repository。

## 購物站設定

以 `PUBLIC_SHOP_URL` 設定獨立購物站的完整 HTTPS 網址；未設定就不顯示購物入口。外連附帶三傑來源與文章 slug 的 UTM，保留原有 query/hash。文章需指定 `relatedProducts` 才顯示文章內商品資訊與購物入口。

個別商品可以在 `src/data/products.ts` 設 `shopUrl` 指向該商品的購物頁，優先於全站購物入口。商品頁會反向列出實際關聯的公開文章，資料來源仍集中在文章的 `relatedProducts`，不另外維護第二份關聯表。

`shop_click` 代表點擊購物入口；訂單與營收必須另接購物站的交易量測，不能用點擊數代替。跨網域 GA4 設定與個別商品購物網址，待購物平台確定再接。

## 移植依據與界線

採用兩站已驗證的架構模式，重新適配三傑 Astro 7 與原生瀏覽器腳本，不整包複製另一個網站。

- 本日有據：`docs/architecture.md` 的文章／專題／搜尋／閱讀互動架構，`src/utils/schema-org.ts` 的穩定實體 ID 與可見內容一致原則，`ReadingEngagement.svelte` 的有效閱讀與讀完判準。
- APPI：`src/utils/visibility.mjs` 的單一公開判斷模式（參考 blob `fa2eb52ab9f5cf44531207a09eb5b43dfedcab27`），`src/content.config.ts` 的文章／作者／專題模型，`scripts/precheck.mjs` 與 `scripts/lib/publish-pipeline.mjs` 的寫入端先預檢，及成長分析以實數與證據為基礎的原則。
- 不搬其他站的識別碼、憑證、署名、審閱宣稱或全域寫作設定。Writer 僅完成三傑站端契約與匯入，Writer 服務端連線、親民文風設定及自動推稿另外串接。
- 首頁與主導覽以文章、專題與搜尋為主要入口；分類依公開文章動態產生，尚未鎖定最終編輯分類。場地與活動資源維持原有方案資料，集中在 `/resources/`。
- 不啟用前台管理後台、會員、LINE 個人化推薦或自動改稿產線；編輯工作可先由 Writer 接稿及本機 CLI 完成。視覺美術與最終內容分類另依回饋調整。
