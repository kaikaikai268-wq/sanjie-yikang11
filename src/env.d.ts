interface ImportMetaEnv {
  readonly PUBLIC_SITE_STAGE?: string;
  readonly PUBLIC_GA_ID?: string;
  readonly PUBLIC_GSC_TOKEN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
