// Centralized API endpoints parsed from the Postman collection
// Base variables in the collection:
// - gapa, based_url → both resolve to https://stockmgt.gapaautoparts.com/api

export const ENDPOINTS = {
  // Products
  featuredProducts: '/product/featured-products',
  topProducts: '/product/top-products',
  allProducts: '/product/all-products',

  // Catalog
  allBrands: '/brand/all-brand',
  allCategories: '/category/all-category',
  manufacturers: '/manufacturers',

  // Partners and misc
  partners: '/getPartners',

  // Search
  liveSearch: '/SearchProduct',
} as const

export type EndpointKey = keyof typeof ENDPOINTS
