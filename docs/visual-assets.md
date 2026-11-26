# 內容圖片與圖解

圖片以說明文章、辨認主題為用途。原本的暖光餐桌、盆栽與空白筆記情境圖不作為網站入口。封面欄位、替代文字與署名統一保留在文章 frontmatter。

## 編輯圖解

`public/images/guides/` 中的 `label-reading`、`probiotic-label`、`consultation-notes`、`sleep-diary` 是專案原創 SVG 圖解，保留向量原稿及同名 PNG。SVG 用程式精確排版，文章引用 PNG，再由既有媒體流程輸出 WebP 與 srcset，維持接稿系統不接受 SVG 的安全邊界。需要重繪時可用 Sharp 將 SVG 轉回 PNG，再執行 `pnpm media:prepare`。

圖解不是商品標示、人體構造研究、療效比較或真實個案。各篇圖說清楚標示示意用途；縮圖保留完整比例，不裁掉文字。

## 食物配圖

`fiber-foods.webp` 與 `calcium-foods.webp` 由內建 `image_gen` 生成，前者用於辨識全穀、豆類與蔬果，後者說明植物飲、豆腐及鈣質判讀的文章。完整生成提示與工具模式保留在 `docs/editorial-image-prompts.json`。

食物圖不是產品實拍、檢測報告或固定菜單；圖說標註 AI 生成，也說明無法從照片判斷營養含量。不可把影像當成數值或功效證據。

## 專題情境圖與品牌圖示

`public/images/topics/reading-labels.webp`、`everyday-table.webp` 由內建 `image_gen` 製作，完整提示見 `docs/design-image-prompts.json`。前者為虛構補充品包裝，不能作為實際商品圖或可辨讀標示的示範；後者為飲食情境，不能視為營養配餐或份量建議。這兩張圖用於專題、首頁入口，圖說標註 AI 生成。現有文章封面與內文不在本輪改寫範圍。

功能圖示使用本地固定版本 Lucide SVG，來源 revision 見 `docs/lucide-revision.txt`，完整授權置於 `public/licenses/lucide.txt`。`Icon.astro` 統一 24 格線與線寬，圖示作裝飾，由周圍控制項文字提供無障礙名稱；不使用遠端字型圖示或載入整包 JavaScript。

業主已選擇沿用原有 3J 圖形，核准使用的副本放在 `src/assets/published-site/brand-mark.png`。標頭、頁尾與網站圖示使用此識別；白底、墨藍字標與小比例圖形保持一致，不增加卡片底、外框、陰影或裝飾。`design/logo-proposal/` 的候選稿只保留為過程參考，不採用。

舊 `src/assets/site/`、`src/assets/products/` 素材保留於本機來源供追溯，不再由 `images.ts` 匯入或產生公開頁面。正式核准素材改放 `src/assets/published-site/`、`src/assets/published-products/`。不要將舊示範圖片重新接回公開建置。

## 上稿流程

分享圖的可編輯 SVG 放在 `design/brand-sharing/share-card.svg`，經有中文字型的設計環境輸出並目視確認後，提交 `src/assets/brand/share-card.png`。建置只複製這份核准的 PNG，不在 CI 重新排中文字，避免 Linux 字型不足而變成方框。favicon 與 apple-touch-icon 也是固定圖片，不在建置時重新繪字。

封面填 `coverImage`、`coverAlt`、`coverCredit`；先執行 `pnpm content:check` 及 `pnpm media:prepare`。渲染一律使用 `ContentImage.astro`，支援子路徑與響應式圖片。圖解 PNG 使用 `data-editorial-graphic` 區分，保持完整構圖；一般攝影縮圖可裁切，但不能改變文章原意。沒有合適圖片時可以使用純文字列表，不強迫每則內容都放裝飾圖片。
