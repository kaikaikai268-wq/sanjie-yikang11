// 示範商品已移除；正式商品與授權素材確認後再建立，購物站另案處理。
export interface Brand { name: string; officialUrl: string; officialLabel: string; note: string }
export const BRANDS: Record<string, Brand> = {};
export type BrandKey = string;
export const CATEGORIES: readonly string[] = [];
export type Category = string;
export interface Product {
  id: string;
  name: string;
  brand: BrandKey;
  category: Category;
  audience: string;
  points: string[];
  extraImage?: string;
  shopUrl?: string;
}
export const PRODUCTS: Product[] = [];
export const productsIn = (category: Category) => PRODUCTS.filter((product) => product.category === category);
