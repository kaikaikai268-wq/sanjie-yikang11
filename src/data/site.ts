// 全站文案與聯絡資料。改文案改這裡，頁面不寫死文字以外的資料。
import type { Category } from './products';

export const SITE = {
  name: '三傑益康生技',
  nameEn: '3J Wellness Biotech',
  motto: ['三傑嚴選，健康相伴', '三節送禮，首選益康'],
  description: '三傑益康生技 3J Wellness Biotech，從日常問題出發，整理健康生活、營養與保健選擇的資訊，陪你看懂資料，找到適合自己的日常做法。',
  slogan: 'Join · Journey · Joy',
};

export const NAV = [
  { href: '/articles/', label: '健康文章' },
  { href: '/topics/', label: '主題指南' },
  { href: '/about/', label: '關於三傑' },
  { href: '/search/', label: '搜尋' },
];

// ga：送到 GA4 contact_click 事件的 channel 參數，改名會讓報表前後不連續
export const CONTACT = {
  phone: { label: '02-23714031#25', href: 'tel:+886223714031;ext=25', ga: 'phone' },
  email: { label: 'jlijoejames688@gmail.com', href: 'mailto:jlijoejames688@gmail.com', ga: 'email' },
  facebook: { label: '加入 FB 粉專', href: 'https://www.facebook.com/share/1LSwWWEaT5/', ga: 'facebook' },
  instagram: { label: '追蹤 IG', href: 'https://www.instagram.com/jlijoejames688', ga: 'instagram' },
};

export const HERO = {
  eyebrow: '3J WELLNESS BIOTECH',
  headline: ['把健康，', '放進日常。'],
  lead: ['從一份日常補給，到一份送給家人的心意。', '用心選品，陪你找到適合自己的健康選擇。'],
  collectionLabel: 'THE EVERYDAY COLLECTION',
  collectionTitle: '日常營養・溫柔照顧',
};

export const SELECTION = {
  title: '用心選品，傳遞關心。',
  lead: '先了解需求，再認識成分與規格。讓每一份選擇，都更貼近你與家人的日常。',
  steps: ['認識合作品牌', '看懂商品資訊', '依照日常需求選擇'],
};

export const NEEDS: { title: string; desc: string; category: Category | null }[] = [
  { title: '日常補給', desc: '想先認識益生菌與營養補給', category: null },
  { title: '家庭保健', desc: '依家人需求與年齡了解商品', category: '益生菌系列' },
  { title: '口腔清潔', desc: '重視每天的刷牙與清潔', category: '口腔清潔系列' },
  { title: '養顏補給', desc: '想了解日常美容補給選擇', category: '養顏美容系列' },
];

export const PROCESS = [
  { title: '瀏覽商品', desc: '查看商品圖片與原廠介紹，認識系列與規格。' },
  { title: '提出需求', desc: '透過社群私訊，告知商品、數量與送禮用途。' },
  { title: '確認方案', desc: '由窗口確認售價、供貨與配送條件。' },
  { title: '確認訂購', desc: '依雙方確認的方案與付款方式辦理。' },
  { title: '配送與追蹤', desc: '依確認的交期安排出貨，持續追蹤服務需求。' },
];

export const PLATFORMS = [
  { name: '品牌網站與社群', phase: '商品展示與洽詢', use: '品牌介紹 · 商品資訊', points: ['集中認識商品與合作品牌', '社群私訊承接商品洽詢', 'AI輔助短影音與內容製作'] },
  { name: '團購與電商合作', phase: '合作洽談方向', use: '團購主 · 自媒體 · 市集電商', points: ['結合合作夥伴既有社群', '先了解商品，再討論代售', '依實際訂單追蹤合作成效'] },
  { name: '企業與團體採購', phase: '送禮需求洽詢', use: '企業贈禮 · 福委會 · 節慶送禮', points: ['依預算與數量討論方案', '春節、端午、中秋送禮提案', '價格與交期依確認方案辦理'] },
];

export const TEAM = [
  { en: 'JLI', name: '李昱愷' },
  { en: 'Joe', name: '蘇喬' },
  { en: 'James', name: '吳達中' },
];

export const ADVISOR = {
  name: '羅揚',
  title: '特約健康食品顧問',
  background: '牙醫醫學士｜APPI News 總編輯',
  bio: '長期關注保健食品、營養補充與健康識讀，以簡單易懂的方式，分享有研究依據的健康資訊。',
  expertise: ['預防醫學與保健食品議題', '營養補充品與健康產業觀察', '血液檢查與常見健康指標解讀', '醫療、營養與保健內容編輯', '健康識讀與大眾衛教', '熟齡族群健康溝通'],
  url: 'https://appi.news/authors/luo-yang/',
};

export const PARTNER_BRANDS = [
  {
    key: 'ymbiomed', tag: '保健商品合作', title: '陽明生醫 × 三傑益康生技',
    desc: '認識一家人益生菌及陽明生醫系列商品，將品牌商品資訊帶進三傑益康的日常選品。',
    tags: ['一家人益生菌系列', '營養補給系列', '原廠商品資訊'],
    image: 'partner-ymbiomed', imageAlt: '陽明生醫 YM BIOMED 正式標誌',
  },
  {
    key: 'lodes', tag: '營養食品合作', title: '樂地滋 × 三傑益康生技',
    desc: '從魚油、益生菌到日常營養補給，認識樂地滋系列商品，探索適合自己的保健選擇。',
    tags: ['魚油', '益生菌', '日常營養補給'],
    image: null, imageAlt: '',
  },
] as const;

// 知域國際場地與活動資源。價格、時數是對外報價，改之前先跟窗口確認。
export const VENUE = {
  intro: '結合陽明生醫、樂地滋營養食品，以及知域國際的場地與活動資源，串連商品展示、交流活動與合作機會。',
  offers: [
    {
      image: 'venue-classroom', imageAlt: '知域國際多功能教室',
      badge: '台北市南陽街3號6樓', title: '知域國際・多功能教室',
      desc: '彈性空間・設備齊全・滿足各種需求。容納 20–30 人，提供投影、Wi-Fi、冷氣，適合教育訓練、講座、工作坊、會議等各類活動。',
      tags: ['20–30人', '免費Wi-Fi', '投影設備', '冷氣空調'],
      cta: { label: 'LINE 洽詢場地 @030hzbid', href: 'https://line.me/R/ti/p/%40030hzbid', ga: 'line_venue' },
    },
    {
      image: 'venue-package', imageAlt: '知域國際基本授證套餐',
      badge: '活動整合套餐', title: '知域國際・基本授證套餐',
      desc: '原價 42,500 元，包套限時 40,000 元。含手冊設計印製、橫幅＆背板製作、靜態攝影4小時、舞台音響4小時，一次搞定活動所有需求。',
      tags: ['24頁手冊×50本', '背板480×270', '攝影4小時', '音響4小時'],
      cta: { label: '詢問套餐', href: 'https://www.facebook.com/JamesWU710102', ga: 'facebook_package' },
    },
  ],
};

export const DISCLAIMER = '健康內容供一般資訊參考，無法代替個人醫療評估。商品資訊整理自原廠公開資料，包裝版本、成分、規格及食用方式以原廠最新公告為準；供貨與售價請洽詢確認。';
