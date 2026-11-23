# 三傑益康生技 3J Wellness Biotech 品牌網站

保健商品展示＋洽詢導流網站。不賣東西、不收單：所有轉換都是導到 FB／IG／電話／LINE，以及原廠商品頁。
原始雛形（單檔 HTML，圖片 base64 內嵌）保留在 `docs/prototype/`，只當參考，不再修改。

Astro 7 純靜態輸出。現在部署在 GitHub Pages 暫時站，目標是正式網域 `https://3jwellness.com`（Cloudflare Workers 靜態資產），見「環境與上線」。無後端、無 UI 框架，互動是頁面內 `<script>`。

## 收手前一定要跑

```
pnpm verify      # astro check → build → 測試（字級、配色、inline style、站內連結、h1/title/alt、收錄設定）
```

正式階段條件另驗：`PUBLIC_SITE_STAGE=production pnpm verify`。

## 指令

| 指令 | 做什麼 |
|---|---|
| `pnpm dev` | 開發伺服器 |
| `pnpm verify` | 收手前檢查（見上） |
| `pnpm catalog` | 商品目錄現況：數量、分類、品牌、圖片是否齊全 |
| `pnpm seo [index\|search\|ga\|submit] [--days N]` | GSC 收錄與搜尋成效、GA4 流量與轉換事件、提交 sitemap |
| `pnpm seo gsc '<json>'`／`pnpm seo ga4 '<json>'` | 自訂 GSC searchAnalytics／GA4 runReport 查詢，原樣輸出 JSON（臨時分析用） |
| `pnpm sync:tokens` | 從上游設計系統同步 `src/styles/tokens.css`（只在本機有上游 repo 時可用） |
| `pnpm deploy` | 以正式階段建置並部署到 Cloudflare（正式網域 DNS 就緒後才用） |

## 數字與狀態：只留指令，不寫進文件

這份文件、README、commit message 都**不寫**商品數量、頁數、流量、收錄數、排名、部署狀態等會變的值。要知道就跑指令，輸出即事實：
商品現況 `pnpm catalog`；收錄與搜尋 `pnpm seo index`／`pnpm seo search`；流量與轉換 `pnpm seo ga`；建置頁數看 `pnpm build` 輸出；部署狀態 `gh run list -w deploy`。
網頁上的數字（分類件數、「顯示 N 款商品」）一律由資料計算，不寫死。

## 改版：改哪裡

| 要改 | 位置 |
|---|---|
| 商品（新增、下架、文案） | `src/data/products.ts`；圖片放 `src/assets/products/<id>.(jpg\|png)`，檔名＝id |
| 品牌、原廠連結 | `src/data/products.ts` 的 `BRANDS` |
| 全站文案、聯絡方式、團隊、顧問、場地方案 | `src/data/site.ts` |
| 站內其他圖片（logo、顧問照、場地照） | `src/assets/site/`，以檔名（不含副檔名）引用 |
| 版面 | `src/layouts/Base.astro`（header／footer／GA／SEO meta）、`src/pages/*.astro`、`src/components/` |
| 樣式與品牌色 | `src/styles/site.css`（`tokens.css` 是上游副本，不要直接改） |

頁面：`/`、`/products/`（篩選＋搜尋，`?category=` 可帶分類）、`/products/<id>/`（每個商品一頁）、`/about/`、`/partners/`、`/contact/`、`/404`。

- 商品 `id` 就是網址，建立後不要改：改了會讓 GSC／GA 的歷史資料斷掉。真要改，在 `wrangler.jsonc` 旁加轉址再改。
- 商品文案只寫原廠公開的成分與規格，**不寫功效宣稱**（食品廣告法規）；完整資訊導回原廠。
- 場地套餐的價格是對外報價，改之前跟窗口確認。

## 設計規範（必守，測試會擋）

- 配色一律 `oklch()`；hex 只能出現在 `@supports not (color: oklch(0 0 0))` 的 fallback 區塊。新增色先在 `site.css` 的 `:root` 加 token，並同步補 fallback
- 品牌：森林綠 `--brand`（hue 160）為主色、金 `--gold`（hue 80）點綴、深藍 `--navy`（hue 260，來自 3J 標誌）；底色暖白 `--bg-page`、鼠尾草綠 `--bg-sage`
- 文字色 L 0.20–0.60（`--text-primary`／`--text-secondary` 或品牌色）
- 字級只用 `--text-xs`(18px) ～ `--text-3xl`(56px)，或 `clamp()` 下限用 token；**最小 18px 無例外**；正文 `--text-base` 24px、行高 1.6
- 標題字體 Noto Serif TC（Google Fonts），內文系統字體
- 不寫 inline `style=`

## 環境與上線

- 建置階段：預設全站 `noindex`＋robots 全擋、不載 GA；`PUBLIC_SITE_STAGE=production` 才開放收錄並載 GA。
- 站內連結一律用 `src/lib/url.ts` 的 `u('/path/')`，不要寫死 `href="/..."`（子路徑部署會斷，`pnpm verify` 的連結測試會擋）。
- **現行：GitHub Pages 暫時站**。`.github/workflows/deploy.yml` 在 push main 時以 `PUBLIC_BASE_PATH=/sanjie-yikang11` 建置並部署到 `https://kaikaikai268-wq.github.io/sanjie-yikang11/`，維持 noindex。Pages 的 Source 要設成 GitHub Actions（repo 設定，需 owner 權限）。部署狀態：`gh run list -R kaikaikai268-wq/sanjie-yikang11 -w deploy`。
- **目標：正式網域 `https://3jwellness.com`**（www 同內容，canonical 指向根網域；`astro.config.mjs` 預設值）。網域在 Porkbun 註冊，DNS 要移到 Cloudflare（帳號 ID 在 `wrangler.jsonc`）；現況用 `dig +short NS 3jwellness.com` 查。`wrangler.jsonc` 已掛根網域與 www 兩個 custom domain，前提是 zone 在該 Cloudflare 帳號裡。
- 切正式網域時：workflow 改成不設 `PUBLIC_BASE_PATH`、`PUBLIC_SITE_URL`，設 `PUBLIC_SITE_STAGE=production` 與 GA／GSC 變數（repository variables `PUBLIC_GA_ID`、`PUBLIC_GSC_TOKEN`），部署步驟換成 `pnpm exec wrangler deploy`（secret `CLOUDFLARE_API_TOKEN`）；之後 `pnpm seo submit` 提交 sitemap。
- GA4 事件（Base.astro）：`contact_click`（參數 `channel`：phone／email／facebook／instagram／line_venue／facebook_package）、`official_click`（參數 `product_id`）。改事件名或參數值會讓報表前後不連續。要在 GA4 報表用參數，先到 GA4「自訂定義」把 `channel`、`product_id` 註冊為事件範圍維度。

## 流量資料（GSC／GA4）

`pnpm seo` 需要的設定（本機放 `.env`，範本 `.env.example`；雲端 session 放環境變數）：

| 變數 | 說明 |
|---|---|
| `GSC_SITE` | Search Console 資源，預設 `sc-domain:3jwellness.com` |
| `GA_PROPERTY` | GA4 資源 ID（純數字，不是 G- 開頭） |
| `PUBLIC_SITE_URL` | 預設 `https://3jwellness.com`，`pnpm seo index`／`submit` 讀線上 sitemap 用 |
| `GOOGLE_SA_EMAIL` | 本機：以 `gcloud auth login` 的使用者模擬此服務帳號，不下載金鑰 |
| `GOOGLE_SA_KEY_JSON` | 雲端 session：服務帳號 JSON 金鑰全文。只放在 claude.ai/code 的環境設定，不進版控 |

權限：服務帳號在 GSC「設定 → 使用者和權限」加為使用者；GA4「管理 → 資源存取管理」加為檢視者。

雲端 Claude session（claude.ai/code）：`.claude/settings.json` 的 SessionStart hook 會跑 `scripts/cloud-setup.sh` 裝依賴。環境的網路設定要允許 `oauth2.googleapis.com`、`searchconsole.googleapis.com`、`analyticsdata.googleapis.com`，`pnpm seo` 才連得到。

分析流程：先 `pnpm seo search` 與 `pnpm seo ga` 看全貌，需要細切時用 `pnpm seo gsc '{"dimensions":["page","query"],"rowLimit":100}'` 這類自訂查詢。回報時貼原始輸出，結論另外寫。
