// 商品資料：網站上所有商品卡、篩選、商品頁都從這裡產生。
// 新增商品：在 PRODUCTS 加一筆，圖片放 src/assets/products/<id>.(jpg|png)，跑 pnpm verify。
// 文案只寫原廠公開資訊；功效宣稱一律不加（食品廣告法規），完整成分與食用方式導回原廠。

export const BRANDS = {
  ymbiomed: {
    name: '陽明生醫',
    officialUrl: 'https://www.ymbiomed.com/%E5%95%86%E5%93%81%E4%BB%8B%E7%B4%B9/',
    officialLabel: '前往陽明生醫商品介紹',
    note: '完整成分、適用對象及食用方式請依商品包裝與原廠說明。',
  },
  lodes: {
    name: '樂地滋 LODES',
    officialUrl: 'https://lodes.com.tw/',
    officialLabel: '前往樂地滋官網',
    note: '完整成分、規格及食用方式請參考樂地滋官方網站。',
  },
} as const;

export type BrandKey = keyof typeof BRANDS;

// 分類順序即篩選按鈕順序
export const CATEGORIES = ['益生菌系列', '營養補給系列', '口腔清潔系列', '養顏美容系列'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  id: string;          // 網址 /products/<id>/ 與圖片檔名，建立後不要改（會斷 GSC/GA 的歷史資料）
  name: string;
  brand: BrandKey;
  category: Category;
  audience: string;    // 「適合誰？」
  points: string[];    // 卡片上的重點（原廠公開的成分／規格）
  extraImage?: string; // 商品頁額外圖片，檔名放 src/assets/products/
  shopUrl?: string;    // 該商品的一頁式購物網址；未設定時使用全站購物入口
}

export const PRODUCTS: Product[] = [
  { id: 'probiotic', name: '一家人益生菌', brand: 'ymbiomed', category: '益生菌系列', audience: '日常消化保養', points: ['YMB520專利菌', '優選6種菌種'] },
  { id: 'probiotic-s', name: '一家人益生菌 S', brand: 'ymbiomed', category: '益生菌系列', audience: '重視消化道日常保養', points: ['YMB520專利菌', '升級版強酵配方'] },
  { id: 'probiotic-ex', name: '一家人益生菌 EX', brand: 'ymbiomed', category: '益生菌系列', audience: '關心日常代謝與飲食保養', points: ['PM308專利菌', '藤黃果與蔬果精粹'] },
  { id: 'kids', name: '一家人兒童益生菌', brand: 'ymbiomed', category: '益生菌系列', audience: '有兒童營養補給需求的家庭', points: ['益生菌與乳鐵蛋白', 'β-葡聚糖配方'] },
  { id: 'calcium', name: '一家人鈣肽高', brand: 'ymbiomed', category: '營養補給系列', audience: '有日常鈣質補給需求的人', points: ['檸檬酸鈣', '三種特殊胜肽'] },
  { id: 'vision', name: '視倍修', brand: 'ymbiomed', category: '營養補給系列', audience: '重視日常晶亮保養的人', points: ['全游離型葉黃素', '巴西綠蜂膠與玻尿酸'] },
  { id: 'toothpaste', name: '一家人益生菌牙膏', brand: 'ymbiomed', category: '口腔清潔系列', audience: '重視口腔清潔與清新口氣的人', points: ['添加YMB520益生菌', '日常刷牙清潔'] },
  { id: 'beauty-drink', name: '一家人玩美姬（飲品）', brand: 'ymbiomed', category: '養顏美容系列', audience: '重視日常養顏補給的人', points: ['莓果精華與白藜蘆醇', '膠原蛋白配方'] },
  { id: 'ym-enzyme', name: '陽明暢快有酵', brand: 'ymbiomed', category: '營養補給系列', audience: '重視餐後消化保養的人', points: ['植萃草本膠囊', '蔬果發酵與消化酵素'] },
  { id: 'ym-night', name: '夜光孅子', brand: 'ymbiomed', category: '營養補給系列', audience: '關心夜間日常保養的人', points: ['毛喉鞘蕊花萃取物', '黑豆種皮萃取物與茶胺酸'], extraImage: 'ym-night-pouch' },
  { id: 'ym-intimate', name: '愛密私 PLUS', brand: 'ymbiomed', category: '益生菌系列', audience: '重視女性日常營養補給的人', points: ['蔓越莓萃取物與甘露糖', '西印度櫻桃萃取物'] },
  { id: 'ym-collagen', name: '極耀膠原凍', brand: 'ymbiomed', category: '養顏美容系列', audience: '喜歡果凍型養顏補給的人', points: ['膠原凍劑型', '獨立包裝，方便攜帶'] },
  { id: 'ym-joint', name: '陽明好關犀', brand: 'ymbiomed', category: '營養補給系列', audience: '重視行動力與日常保養的人', points: ['全方位關鍵配方', '日常營養補給'] },
  { id: 'ym-d3', name: '陽明維生素D3', brand: 'ymbiomed', category: '營養補給系列', audience: '有維生素D日常補給需求的人', points: ['維生素D3與維生素E', '噴劑型，20ml'] },
  { id: 'lodes-fish', name: '高濃度極醇魚油', brand: 'lodes', category: '營養補給系列', audience: '重視日常營養補充的人', points: ['魚油 Omega-3', '60粒入'] },
  { id: 'lodes-night', name: '明日益生菌－夜間好眠 Night', brand: 'lodes', category: '益生菌系列', audience: '關心夜間保養與日常補給的人', points: ['夜間益生菌系列', '30粒／袋'] },
  { id: 'lodes-e', name: '還原E－青春膠囊', brand: 'lodes', category: '養顏美容系列', audience: '重視養顏與日常保養的人', points: ['青春膠囊系列', '60粒入'] },
];

export const productsIn = (c: Category) => PRODUCTS.filter((p) => p.category === c);
