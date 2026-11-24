# 內容頁面維護

## 內容首頁

首頁 `src/pages/index.astro` 以文章為入口：主打與側欄選讀、時間序列、專題閱讀順序與分類目錄。搜尋放在全站刊頭，商品與合作資訊放在網站說明及頁尾。版面與編排規則見 [visual-redesign.md](visual-redesign.md)。

所有候選來自共用 `getPublishedArticles()` 與 `getPublishedTopics()`。`src/lib/home-content.mjs` 以相同公開判斷防止草稿及未來文章進入首頁；主打以 `featured` 優先並按發布日期補足，側欄依 `src/data/editorial.ts` 的順序選讀，再以公開稿補足；最新列表排除主打與選讀 slug。分類名稱與件數從實際公開文章計算。專題只顯示有公開文章的啟用中主題，並保留其編輯閱讀順序。

空內容庫顯示準備中訊息與編輯原則、內容團隊等真實入口，不放測試文章或虛構篇數。搜尋使用 GET 表單導到 `/search/?q=...`，所有站內連結都經 `u()` 支援子路徑。首頁只加入反映可見文章的 CollectionPage，機構實體圖由 Base 統一提供。

## 路由與資料

- `/articles/`：公開文章首頁；分頁大小由 `src/lib/content-view.ts` 的 `ARTICLE_PAGE_SIZE` 決定。
- `/articles/page/<page>/`：其餘文章分頁；不產生第一頁的重複網址。
- `/articles/category/<category>/`：從公開文章的分類自動產生，不預先固定主題名稱；後續分頁為 `/articles/category/<category>/page/<page>/`。
- `/articles/<slug>/`：由共用公開判斷挑出可發布文章，Markdown 透過 Astro render 渲染。
- `/topics/`、`/topics/<id>/`：只列出有公開文章的啟用中專題；有 `sections` 時按讀者問題分段，剩餘文章列在後面。
- `/authors/`、`/authors/<id>/`：呈現實際作者或團隊身分；不自動生成專業資格或審閱背書。

文章、專題及作者欄位定義以 `src/content.schemas.mjs` 為準。全站公開資料入口在 `src/lib/content.ts`；任何新列表或輸出都應使用這一層，不得自行用 status 單欄判斷。

空文章、空專題及尚無作品的作者頁使用 `noindex`。草稿、待審及未來文章不產出單篇網址。測試文章只放在測試暫存資料中，不以公開內容充數。

## 文章閱讀

`src/layouts/Article.astro` 組合文章標題與日期、作者、封面、摘要、二級標題目錄、正文、常見問題、來源、關係揭露、延伸閱讀與分享。頁面只顯示實際填寫的欄位；通用免責由 Base 頁尾統一處理。

相關文章依共用 helper 選取，優先手動指定，再看相同專題與標籤，不用不相關的最新文章硬填。商品只依 `relatedProducts` 手動關聯到本站既有商品資料頁；一頁式購物網址與導購規則另由站台設定處理。

圖片使用 `ContentImage.astro`，由建置前媒體管線產生響應式圖檔。文章元件無 UI framework；目錄是原生錨點、FAQ 是原生 details。分享按鈕支援 LINE 與剪貼簿，無剪貼簿權限時提示從網址列複製。

文章標題、麵包屑與列表長文字可斷行。目錄保留瀏覽器原生網址片段及返回紀錄，操作時把鍵盤焦點移至相應段落；標題的 `scroll-margin-top` 保留定位間距。桌面長目錄可在側欄內捲動，手機版放回正文前。

表格與程式碼在瀏覽器載入後放入具名稱、可鍵盤聚焦的局部捲動區，保留表格本身的語意。文章資訊列提供同篇 `.txt` 純文字版本入口。分享結果透過完整的 aria-live 區塊宣告，複製中暫停重複送出。

## SEO 與量測

- Base 提供站台實體圖；文章提供 Article、BreadcrumbList 與有實際可見問答時的 FAQPage。
- 列表與專題用 CollectionPage/ItemList，內容與畫面使用同一批公開資料。
- 作者以 `isOrganization` 決定 Organization 或 Person，不套用不存在的醫療資格。
- 閱讀追蹤掛在 `data-reading-article`；正文使用 `data-article-body` 及 `data-pagefind-body`；來源使用 `data-reference-list`，尾段使用 `data-reading-end`，相關連結使用 `data-related-article`。
- `src/lib/reading-client.ts` 接收文章 slug、分類及預估閱讀時間。分享區、來源與版型文字不放進 Pagefind 正文。

修改頁面後跑 `pnpm verify`，包含原有設計規範與產出連結檢查。功能性的草稿隔離與有內容頁面檢查由整合測試驗證。
