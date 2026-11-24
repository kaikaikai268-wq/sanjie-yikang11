# 內容與 Writer 接稿

## 資料入口

文章：`src/content/articles/<slug>.md`；作者：`src/content/authors/<id>.md`；專題：`src/content/topics/<id>.md`。
網址使用小寫英數與連字號，建立後保持穩定。最終內容分類尚待品牌架構討論，`category` 是自由文字；`contentType` 支援 `guide`、`ingredient`、`question`、`research`。

共用欄位正本是 `src/content.schemas.mjs`，Astro 與 Node 接稿預檢都引用它。這套模型參考 APPI 的文章／作者／專題分工，採 Astro 的 glob loader；公開判斷參考 APPI 的單一實作模式，並收緊為不輸出任何草稿或送審預覽。

## 狀態與時間

- 新文章預設 `status: draft`。
- `draft`、`review`、`archived` 或 `draft: true` 永不公開。
- `published`、`scheduled` 必須有合法 `publishDate`，且只有日期已到才公開。
- 日期 `YYYY-MM-DD` 代表台北當日午夜。日期時間沒有時區時，依台北 `+08:00`；也可明確填 `2026-11-24T09:00:00+08:00`。
- 靜態站需要在日期到達後重建，才會上線。定時重建由部署 workflow 承接；不把未到期稿的內容預先輸出到網址。
- 一次正式建置會設定 `CONTENT_BUILD_TIME`，媒體、路由與各種索引使用同一時點判斷，避免建置中途跨過排程時間；自行設定時需使用帶時區 ISO 日期時間，格式錯誤會中止。
- 列表、單篇頁、搜尋、專題、RSS、純文字與 sitemap 均使用同一份公開判斷，不能自行以 `!draft` 代替。

查文章狀態用 `pnpm content stats --json`，檢查資料用 `pnpm content:check --json`。文件不記錄會隨發布改變的篇數或排程存量。

## 文章格式

```yaml
---
title: 文章標題
description: 說明本文實際回答什麼問題
status: draft
author: 3j-editorial
category: 健康生活
contentType: guide
tags: []
topics: []
references: []
---

## 第一個問題

正文使用 Markdown，不另放 h1。具體事實與說法附上可核對的來源。
```

發布或排程前必須填 `publishDate` 與真實、可點閱的 `references`。來源格式為 `{ title, url, publisher?, note? }`；不強制學術篇幅或固定論文數，編輯仍需確認內容與引用的對應關係。

可選欄位包括 `updatedDate`、`coverImage`、`coverAlt`、`coverCredit`、`highlights`、`faq`（`question`／`answer`）、`relatedArticles`、`relatedProducts`、`disclosure`。封面與正文圖片放在 `public/content/`、`public/images/` 或 `public/covers/`，欄位用 `/content/...webp` 這類站內路徑，不接受圖片外連、query 或相對目錄；設定封面時必填替代文字。所有來源只接受 HTTP／HTTPS，正文只接受 Markdown，不接收 HTML 標籤、MDX 或不安全網址。

作者資料填實際的姓名或團隊署名、介紹、可驗證資歷與外部身分頁。機構署名設 `isOrganization: true`；不得把團隊整理標成醫事資格或專業審閱。`3j-editorial` 是團隊整理署名，不是審閱認證。

專題可以填 `articles`，也可讓文章的 `topics` 反向關聯。`sections` 可依問題編排文章，每段有 `title`、`summary`、`articles`。沒有已公開成員的專題不產生公開入口。

## Writer JSON 契約

```json
{
  "schemaVersion": 1,
  "jobId": "三傑專用且不可重複的工單識別碼",
  "article": {
    "slug": "stable-article-slug",
    "title": "文章標題",
    "description": "本文回答的問題",
    "author": "3j-editorial",
    "references": []
  },
  "body": "Markdown 正文"
}
```

先 `pnpm writer:import <檔案.json> --dry-run --json`，通過後去掉 `--dry-run` 建立草稿。即使輸入寫 `published`，匯入也會強制存為草稿。圖片需先由授權的檔案工作流程放入指定 public 目錄，再在 JSON 引用；接稿工具不下載外部圖片、不接收任意路徑寫入。

同一 `jobId` 同一內容重送回 `unchanged`；內容不同或網址已存在會失敗，避免蓋掉編輯修改。工具不覆寫文章、不 commit、不 push，也不宣告 Writer 服務已接通。Writer 服務端之後應呼叫本工具或遵循相同 JSON 契約，再由編輯檢查與發布流程承接。

編輯確認後，將 `status` 設為 `published` 或 `scheduled`，同時把 Writer 草稿的 `draft` 改為 `false`，填好發布日期與來源，再執行內容預檢與整站驗證後提交。只改 `status`、仍保留 `draft: true` 的文章不會公開。

預檢會檢查 schema、作者／專題／延伸閱讀／商品關聯、重複網址與標題、圖片檔案、h1 與不安全內容。Markdown 用 CommonMark AST 辨識實際連結、圖片與 HTML，程式碼範例不會當成可執行內容，inline 與 reference 圖片共用同一個提取函式。公開正文不可連向未發布文章或沒有公開入口的專題。網路來源的真偽與每句話的對應仍是編輯工作，預檢不以網址格式通過冒充查證完成。

## 可直接測試的 Writer 交付範例

範例檔是 `docs/examples/writer-draft.json`，放在文件目錄，不是站內文章。它只說明接稿流程，沒有健康事實或商品功效；請維持草稿，正式使用前換成自己的工單碼與內容。

```text
pnpm writer:import docs/examples/writer-draft.json --dry-run --json
```

成功時 exit code 是 `0`，標準輸出為 JSON，`status` 是 `valid`、`dryRun` 是 `true`；不建立文章。實際建立可去掉 `--dry-run`，回傳 `created`；同一份工單重送回傳 `unchanged`。失敗時 exit code 是 `1`，標準錯誤為 `{ "ok": false, "error": "原因" }`。自動化應先檢查 exit code，再解析對應輸出；不可把成功建立草稿當成已發布。

機器驗證的唯一真相仍是 `src/content.schemas.mjs` 與上述 CLI dry-run。Zod 的日期 preprocess、來源協定、圖片路徑與跨欄位 refinement 無法無損匯出成標準 JSON Schema；只做結構匯出會漏掉這些規則。因此沒有另附一份看似完整卻規則不同的 JSON Schema，Writer 服務應直接呼叫本站驗證入口，不自行抄一套欄位檢查。

要重跑交付契約的正反測試，執行 `node --test test/writer-cli.test.mjs`。測試在暫存工作區透過真實 CLI 驗證範例、dry-run、重送衝突、明確要求發布仍為草稿，以及錯誤 JSON／不安全內容失敗；不會把範例寫進本站內容目錄。
