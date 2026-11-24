# 編輯、排程與發布 CLI

這是 Writer 建立草稿之後的本機編輯流程。它只操作指定的一篇 Markdown，不連網、不 build、不 commit、不 push，也不替任何人掛上審閱身分。

## 查看待處理內容

```text
pnpm editorial list --json
pnpm editorial list --status draft,review --json
pnpm editorial readiness <slug> --json
```

列表會顯示實際狀態、是否公開、發布日期、原稿 SHA256，以及是否缺少來源或封面。`readiness` 依共用 schema 與全站關聯檢查，說明這篇能否現在發布；封面未填是提醒，來源未填則阻擋發布。沒有固定學術篇幅或論文篇數門檻。

機器應以每次輸出為準，文件不記錄文章存量或目前排程。`readiness` 若無法發布會回非零退出碼；它不會改檔。

## 先看計畫，再明確寫入

```text
pnpm editorial review <slug>
pnpm editorial publish <slug> --date "2026-11-24T09:00:00+08:00"
pnpm editorial schedule <slug> --date "2099-01-01T09:00:00+08:00"
pnpm editorial archive <slug>
pnpm editorial draft <slug>
```

以上全是 dry-run。工具輸出原狀態、目標狀態、`draft`、計畫發布日期、驗證時點與來源 SHA。確認後在原指令加 `--write` 才會修改檔案。也可用 `transition <slug> <draft|review|published|scheduled|archived>` 的通用形式；`submit` 是 `review` 的別名。

日期範例只是示範格式，實際操作請填所需日期；排程一定要晚於操作當下。

- 送審、退回草稿、封存：保留既有發布日期，不接受 `--date`，並將 `draft` 設為 `true`。
- 發布：將 `draft` 設為 `false`。有已到期日期時保留原值，沒有日期時在計畫中明確列出當下台北 ISO 時間。
- 既有日期仍在未來：不會默默改成現在發布。可以保留排程；若確實要提前，必須用 `publish --date <已到期日期>` 明確修改。
- 排程：必須明確填未來日期，並在計畫發布時點檢查站內文章與專題是否已公開，避免將來上線時出現死連結。
- 發布與排程都必須有非空正文及可點閱來源，且通過共用 schema、作者／專題／商品／文章關聯、圖片與 Markdown 安全檢查。
- 如果封存會讓另一篇公開文章的內鏈失效，工具也會阻擋；請先由編輯處理連入文章，不自動改動其他稿件。

這是編輯狀態轉換，不代表事實已查證或專業審閱已完成。內容仍需編輯核對，網站也要在後續驗證與部署後才會更新。

## 避免覆寫他人的修改

```text
pnpm editorial publish <slug> --expected-sha <列表或計畫中的sourceSha256> --write
```

`--expected-sha` 可鎖定自己看過的原稿版本。即使沒有傳這個參數，工具仍會在讀取後、同目錄暫存檔準備完畢及替換前檢查原稿 SHA；發現有人改稿就中止，保留人工修改。寫入使用同目錄暫存檔與 rename，失敗清除暫存檔，不半寫原稿。

文章實際檔名與公開 `slug` 可以不同。工具用穩定 slug 尋找文章，更新原檔並保留 slug、Writer jobId 與正文，不建立另一篇稿。未知欄位由共用 schema 拒絕，不默默丟掉。

所有命令以 JSON 輸出。成功退出碼 `0`；參數、驗證或版本衝突錯誤以退出碼 `1` 及標準錯誤 JSON 回報。`readiness` 的未就緒結果仍在標準輸出，欄位有 `ok: false`、`canPublish: false`、`errors`，退出碼為 `1`。

測試入口：`node --test test/editorial.test.mjs`。測試使用暫存工作區，不修改本站文章。
