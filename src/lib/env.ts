// 建置環境。本機與預覽：全站 noindex＋robots 全擋、不載 GA。
// 正式部署（GitHub Actions）設 PUBLIC_SITE_STAGE=production 才開放收錄。
export const IS_PRODUCTION = import.meta.env.PUBLIC_SITE_STAGE === 'production';
// GA4 評估 ID 會出現在網頁原始碼，本來就公開，直接寫預設值；只在 production 階段載入。
export const GA_ID: string = import.meta.env.PUBLIC_GA_ID || 'G-K1GS5Q1QEN';
export const GSC_TOKEN: string = import.meta.env.PUBLIC_GSC_TOKEN ?? '';
