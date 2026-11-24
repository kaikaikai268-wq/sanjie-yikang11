# 內容站視覺素材

首頁以自然光生活情境、暖白、森林綠與襯線標題建立閱讀入口；文章與主題列表沿用圖文雙欄、金色細線與同組圖示。響應式版面在窄螢幕改為單欄，保留大字級與鍵盤焦點。

## 來源與用途

`public/images/editorial/` 的照片由內建 `image_gen` 依下方提示生成，屬 AI 情境配圖，並非三傑團隊、產品、辦公室或研究紀錄的實拍。請勿用作功效證據或人物見證。輸出為 WebP，含桌面與行動裝置尺寸；圖片的尺寸、載入優先順序與 srcset 在引用處明確設定。

| 檔名（含同名 -640 版本） | 用途 |
|---|---|
| `daily-nutrition.webp` | 首頁主視覺、健康文章入口、飲食閱讀入口 |
| `evening-calm.webp` | 主題指南與日常閱讀入口 |
| `thoughtful-reading.webp` | 編輯方式閱讀入口 |

圖示取自 [Lucide](https://github.com/lucide-icons/lucide)，由 `src/components/WellnessIcon.astro` 輸出 SVG；授權保留於 `public/licenses/lucide.txt`。版面研究參考 [AstroWind](https://github.com/arthelokyo/astrowind) 的組合式圖文區塊，以及 [Starlight](https://github.com/withastro/starlight) 對清楚閱讀層次與可及性的重視；未引入其框架或主題。

## 生成提示（內建工具，非 API CLI）

### daily-nutrition

```text
Use case: photorealistic-natural. Asset type: landscape editorial hero photograph for Taiwanese wellness reading website 三傑益康. Primary request: a beautiful quiet everyday morning breakfast still life by a large window, oatmeal in a handmade cream bowl with berries, a small plate of sliced guava, unsweetened yogurt in a clear glass, a glass of water, folded linen napkin and a small leafy branch. Medium: premium authentic magazine photography, realistic food and tactile textures. Composition: landscape 3:2 photograph, medium close crop, objects thoughtfully arranged across the lower center and right, gentle negative space upper left; all objects fully believable, no people. Lighting: soft warm morning sunlight with real diagonal window shadows, refined olive-sage green and ivory palette, subtle film grain. Background: warm limestone tabletop, soft green garden bokeh. No text, no logo, no watermark, no pills, no packaging, no health charts. This is mood imagery, not a medical illustration.
```

### evening-calm

```text
Use case: photorealistic-natural. Asset type: editorial lifestyle banner photograph for a warm, accessible Taiwanese wellness content magazine. Subject: a peaceful evening reading corner with a closed blank cloth-bound book, ceramic mug of warm water, linen cushion, small olive plant, sculptural table lamp, light sheer curtain, no people. Composition: wide 3:2 horizontal still life, book and mug at lower center, generous soft atmospheric background. Medium: premium realistic interiors editorial photography, tactile ivory linen, muted sage green and warm honey lamplight, soft blue dusk through window. Calm authentic lived-in space, sophisticated natural imperfect textures, gentle shadows. No text, no branding, no watermark, no medicine, no claims or charts. Image will illustrate everyday routines and rest, not be presented as evidence.
```

### thoughtful-reading

```text
Use case: photorealistic-natural. Asset type: landscape 3:2 editorial photograph for Taiwanese wellness magazine about making sense of nutrition information. Scene: an inviting light oak desk beside a window, open notebook with entirely blank ivory pages, simple pencil, round thin gold reading glasses, small white ceramic dish of raw almonds and a pear, translucent glass of water, small plant at edge. Premium tactile editorial still life photography, not a product ad. Camera slightly overhead at 45 degrees, balanced composition with notebook as central subject, natural soft afternoon light and leaf shadows, ivory, sage, light wood and restrained golden palette. No people, no text, no numbers, no labels, no packaging, no branding, no watermark, no pills or medical diagrams.
```
