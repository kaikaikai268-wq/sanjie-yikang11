# 內容搜尋、閱讀與成效

## 搜尋

搜尋頁為 `/search/`。Pagefind 在靜態建置後建立索引；用 `pnpm build`、`pnpm preview` 驗證實際搜尋，`pnpm dev` 不會自動產索引。搜尋頁不收錄，搜尋結果由公開頁面的索引產生。索引必須排除草稿、排程中內容及頁首／頁尾。搜尋詞只在瀏覽器執行。Base 在搜尋頁完全不載入 GA，避免 GA 增強型評估自動蒐集健康搜尋詞；其他頁的 page_location 與 page_referrer 皆去除 query/hash，避免搜尋詞隨下一頁來源網址回傳。

`src/lib/search-client.ts` 按需載入 Pagefind，使用 `u('/pagefind/pagefind.js')` 支援子路徑；結果以 DOM textContent 填寫。搜尋失敗提供文章／專題入口；結果逐批載入，狀態以 aria-live 宣告。

頁面建置時由同一套公開內容判斷取得索引數量。沒有公開文章與專題時，直接顯示「目前尚無公開文章，可稍後再試。」，不載入空的 Pagefind 索引，也不呼叫搜尋。摘錄以純文字處理，不用 HTML parser，避免不可信摘錄發起圖片請求；結果連結只接受本站且不含帳密的網址。

### 操作驗收

先以公開測試內容建立索引，再用 `pnpm preview` 開 `/search/`，分別驗證鍵盤送出與「載入更多」。同一查詢的下一批失敗時，保留已顯示結果並允許再試；新查詢會清空舊結果。搜尋按鈕在等待時仍可送出另一個查詢，較舊請求回覆不得覆蓋新結果、狀態或 busy 標記。

可在瀏覽器網路面板阻擋搜尋索引／片段請求，驗證錯誤提示與重新送出的恢復路徑；也要驗證無結果及空索引。Network 不應出現 GA 請求，摘錄或標題中的 HTML 應顯示為文字，搜尋結果不應導向其他網域。子路徑部署時，Pagefind 模組與結果網址都必須保留部署 base。

自動檢查執行 `node --test test/search.test.mjs`。測試透過載入器注入模擬 Pagefind，實際執行 `search-client.ts` 的事件處理與 DOM 更新，不依賴外部搜尋或新增瀏覽器套件；實際瀏覽器閱讀與搜尋另做上述操作驗收。

## 閱讀事件

沿用三傑自己的 GA4 設定。未載入 GA 的本機與預覽不會傳送事件。閱讀腳本為 `src/lib/reading-client.ts`，判準集中在 `reading-core.mjs`，由文章版型載入。

| 事件 | 判準／參數 |
|---|---|
| `content_view` | 進入文章；`article_slug`、`content_category` |
| `scroll_depth` | 正文 25／50／75／90% 各一次；`percent_scrolled` |
| `read_complete` | 正文至少 90%、到達文末、曾主動操作，且有效閱讀時間達門檻 |
| `engaged_view` | 離開前景或頁面時送尚未回報的有效秒數；同一段不重複累計 |
| `select_content` | 延伸閱讀點擊；`target_path` 僅站內路徑 |
| `reference_click` | 參考來源點擊；只送 `link_domain` |
| `shop_click` | 由全站 Base 處理 `data-ga-shop` 連結，傳 `product_id`、`article_slug`、`link_domain`、`placement`，避免文章腳本重複送出 |

有效時間只累計頁面可見、有焦點且最近 30 秒內有操作的區段。讀完時間門檻為估計閱讀分鐘的一半，下限 20 秒、上限 240 秒。快速滑底、背景分頁與未操作的一屏短文不會直接算讀完。瀏覽器上一頁快取恢復時重新計算本次閱讀。

文末標記位於「資料來源」區塊的開頭，代表正文與常見問題已結束，不要求讀者再滑過作者介紹、分享與商品資訊。離開前景、失焦與 pagehide 會停止計時器；恢復前景或瀏覽器快取恢復才重啟。離開瞬間不足一個計時刻度的時間可能不計入，避免把背景時間灌入閱讀。

掛載契約：文章根元素 `data-reading-article`、`data-article-slug`、`data-article-category`、`data-reading-minutes`；正文 `data-article-body`；文末 `data-reading-end`；延伸閱讀連結 `data-related-article`；來源容器 `data-reference-list`。

在 GA4 自訂定義中註冊需要報表分組的事件維度（如 article_slug、content_category）。GA 即時／DebugView 驗證事件收到後，再用查詢工具檢查報表；程式測試通過不代表 GA 已實際收到。

## 成效查詢

```
pnpm insights --days 28
pnpm insights --days 28 --output data/analytics/snapshot.json
pnpm insights --input data/analytics/snapshot.json
```

認證沿用 `scripts/lib/google.mjs`：`.env` 設 `GOOGLE_SA_EMAIL`，以 gcloud 登入後模擬服務帳號；雲端可用 `GOOGLE_SA_KEY_JSON`。資源為三傑自己的 `GSC_SITE`、`GA_PROPERTY`，不使用其他站台的憑證。設定詳見 CLAUDE.md「流量資料」。

輸出包含實際來源、台灣日期窗、搜尋詞 × 文章、文章到達工作階段、閱讀與導購事件，以及附資料證據的人工檢查建議。為 GSC 留三個完整日的處理時間。GA4 查詢只接受正式 hostName 的資料。某來源失敗會列明且以 exit 2 回報部分資料，availability 標記 unavailable，該來源總計為 null；認證或全部來源失敗以 exit 1 結束，不以零流量代替查詢失敗。

快照含搜尋詞與經營資料，存到被 gitignore 的 `data/analytics/`；不要提交到公開 repo。`--input` 可離線分析同一格式快照，不會連 Google。日期、數字型別、負數、點擊率範圍、事件名稱及來源狀態互相矛盾時會拒絕分析，不把錯誤資料強轉零。Google 憑證只由環境變數或 gcloud 取得，CLI 不接受 token／金鑰參數。分析工具不改文章、不排程發布、不對外發訊息。

搜尋曝光只加總 API 回傳資料，可能不包含匿名搜尋詞與超過列數上限的結果。到達工作階段、讀完事件與購物點擊分母不同，分開呈現；未串接購物站交易資料時，購物點擊不能當成訂單或營收。

來源：本日有據閱讀互動與 Pagefind 架構、APPI 的搜尋詞重疊與成效回饋概念。此版本以原生 TypeScript／Node 實作，不搬其他站的分析 ID、憑證、Svelte runtime 或自動改稿排程。
