// 建置環境。本機與預覽：全站 noindex＋robots 全擋、不載 GA。
// 正式部署（GitHub Actions）設 PUBLIC_SITE_STAGE=production 才開放收錄。
export const IS_PRODUCTION = import.meta.env.PUBLIC_SITE_STAGE === 'production';
export const GA_ID: string = import.meta.env.PUBLIC_GA_ID ?? '';
export const GSC_TOKEN: string = import.meta.env.PUBLIC_GSC_TOKEN ?? '';
