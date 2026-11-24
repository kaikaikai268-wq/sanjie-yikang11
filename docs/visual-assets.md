# 內容圖片與圖解

圖片以說明文章、辨認主題為用途。原本的暖光餐桌、盆栽與空白筆記情境圖不作為網站入口。封面欄位、替代文字與署名統一保留在文章 frontmatter。

## 編輯圖解

`public/images/guides/` 中的 `label-reading`、`probiotic-label`、`consultation-notes`、`sleep-diary` 是專案原創 SVG 圖解，保留向量原稿及同名 PNG。SVG 用程式精確排版，文章引用 PNG，再由既有媒體流程輸出 WebP 與 srcset，維持接稿系統不接受 SVG 的安全邊界。需要重繪時可用 Sharp 將 SVG 轉回 PNG，再執行 `pnpm media:prepare`。

圖解不是商品標示、人體構造研究、療效比較或真實個案。各篇圖說清楚標示示意用途；縮圖保留完整比例，不裁掉文字。

## 食物配圖

`fiber-foods.webp` 與 `calcium-foods.webp` 由內建 `image_gen` 生成，前者用於辨識全穀、豆類與蔬果，後者說明植物飲、豆腐及鈣質判讀的文章。完整生成提示與工具模式保留在 `docs/editorial-image-prompts.json`。

食物圖不是產品實拍、檢測報告或固定菜單；圖說標註 AI 生成，也說明無法從照片判斷營養含量。不可把影像當成數值或功效證據。

## 上稿

封面填 `coverImage`、`coverAlt`、`coverCredit`；先執行 `pnpm content:check` 及 `pnpm media:prepare`。渲染一律使用 `ContentImage.astro`，支援子路徑與響應式圖片。圖解 PNG 使用 `data-editorial-graphic` 區分，保持完整構圖；一般攝影縮圖可裁切，但不能改變文章原意。沒有合適圖片時可以使用純文字列表，不強迫每則內容都放裝飾圖片。
