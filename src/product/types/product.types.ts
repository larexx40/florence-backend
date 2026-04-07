export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  minOrderQty: number;
  orderIncrement: number | null;
  category: { id: string; name: string; slug: string };
  priceRange: PriceRange | null;
  inStock: boolean;
  coverImage: string | null;
}
