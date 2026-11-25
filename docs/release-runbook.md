# 發布驗收與上線判讀

## 本機產物驗收

```
pnpm build
node scripts/release-check.mjs
node scripts/release-check.mjs --strict-launch
```

普通驗收檢查產物是否一致；未有公開文章、購物入口未設定、部分文章無封面及 GA4 尚未實收驗證只列 warnings/readiness，不中斷維護建置。`--strict-launch` 額外要求 production 建置與至少一篇公開文章；它不代表 GA 已收到事件，也不代表網站已部署。CLI 的 exit 0 表示該模式的可機械檢查通過；exit 1 是產物或遠端驗證錯誤；只有 strict-launch 尚未滿足時回 exit 2。普通維護即使 ready 為 false，只要 ok 為 true 仍以 exit 0 結束。

報告欄位分開判讀：`ok` 表示產物檢查通過；`ready` 表示 ok、production 建置且已有公開文章，是最低機械上線條件；`live.verified` 只在明確連線驗證了本次 build 的公開端點後才為 true。preview 或零文章時 ready 永遠為 false，不能把一般建置成功宣稱為上線準備完成。GA4 實收仍是獨立的 unverified 項目。

`scripts/build.mjs` 在 postbuild 後執行 `node scripts/release-check.mjs`，再跑 verify 測試。不要在每次一般維護加 strict-launch，以免內容還在準備就把基礎建設部署擋住。

GitHub Actions 的站台、basePath、購物網址、GA 與可選驗證 token 由 repository variables 對應到建置環境。未填值時仍採程式的預設站台與 GA 設定；購物網址未填則不顯示購物入口。功能分支、PR 與功能分支的手動 workflow 不會部署 GitHub Pages；只有 main 的非 PR 工作可以部署。

## Build identity

`scripts/postbuild.mjs` 最後寫入公開的 `dist/build-info.json`，由 `scripts/lib/build-manifest.mjs` 的 `writeBuildManifest({ root, dist })` 產生。只公開 schemaVersion、builtAt、publicationTime、stage、basePath、site 與可取得時的完整 Git commit SHA。不加入草稿數量、草稿路徑、環境變數全文或憑證。

publicationTime 是這一輪 `CONTENT_BUILD_TIME` 的固定發布切點，驗收也以同一時間呼叫內容核心的 `isPublicFrontmatter`。建置之後才到期的稿不能被驗收工具用當下時間誤認為漏頁。來源已修改而產物仍舊時，先重建，不以移除驗收規則避開。

postbuild 缺少 `CONTENT_BUILD_TIME` 時拒絕寫 manifest，避免在建置尾端另取時間而宣稱是整輪的發布切點。正常 `pnpm build` 會由 wrapper 統一設定，不需手動傳時間。

## 檢查範圍

- 所有 HTML 的唯一 h1、canonical、description、可解析 JSON-LD；production 的 metadata 不得指向 localhost。
- 依單一公開判斷取得的文章集合，必須與 HTML 文章、reader-index、RSS、llms.txt、llms-full.txt 一致。
- Sitemap 不能含 noindex；preview 的 noindex 文章不要求進 sitemap。
- 搜尋頁 noindex 且不載 GA；Pagefind entry 的真實 page_count 要符合公開文章與有效專題，必要 JS、metadata 與 wasm 產物必須存在。
- 預設 OG PNG 必須存在。公開內容數、缺封面與待設定服務只列在本機報告，不加入公開 build-info。

## 線上唯讀驗收

```
node scripts/release-check.mjs --url https://3jwellness.com
```

只有明確提供 `--url` 才會連網；預設只讀 dist。子路徑部署需把同一 basePath 放在 URL，例如 `https://example.com/base`。

工具只 GET build-info、reader-index、RSS、llms、sitemap-index、搜尋頁、預設分享圖與 Pagefind 模組。它不提交 sitemap、不改 DNS、不發布文章、不寫任何遠端資源。網路失敗會列明，不能用本機檢查通過宣稱上線成功。

線上 build-info 的 builtAt、publicationTime、stage、basePath、site 與 commit 必須和本次產物相同，才可說這一版的公開端點已驗證。這仍不等於所有頁面的瀏覽器操作、GA4 實收或交易流程通過；搜尋、文章閱讀、LINE 分享與 GA DebugView 依各自操作手冊確認。

## 接續事項

正式內容準備好後跑 strict-launch；購物站網址確認後驗證導流及事件；GA4 用 DebugView／即時報表確認實收，再執行內容成效查詢。不要把「程式存在」「產物通過」「部署成功」「讀者行為實收」混為同一個完成狀態。
