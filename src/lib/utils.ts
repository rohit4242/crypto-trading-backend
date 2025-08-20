import { Spot } from "@binance/spot";
import type { ApiCredentials } from "../schemas/binance.js";

export const getCurrentPrice = async (
  symbol: string,
  credentials: ApiCredentials
) => {
  const binance = new Spot({
    configurationRestAPI: credentials,
  });

  const response = await binance.restAPI.tickerPrice({
    symbol: symbol,
  });
  const data = (await response.data()) as any;
  return Number(data.price);
};

export interface SymbolFilter {
  filterType: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minNotional?: string;
  applyToMarket?: boolean;
  avgPriceMins?: number;
  multiplierUp?: string;
  multiplierDown?: string;
  multiplierDecimal?: number;
}

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  orderTypes: string[];
  filters: SymbolFilter[];
}

export const getSymbolInfo = async (
  symbol: string,
  credentials: ApiCredentials
): Promise<SymbolInfo | null> => {
  const binance = new Spot({
    configurationRestAPI: credentials,
  });

  const response = await binance.restAPI.exchangeInfo({ symbol });
  const data = (await response.data()) as any;
  
  if (data.symbols && data.symbols.length > 0) {
    return data.symbols[0];
  }
  
  return null;
};

export const validateOrderQuantity = (
  quantity: number,
  symbolInfo: SymbolInfo
): { valid: boolean; error?: string; adjustedQuantity?: number } => {
  const lotSizeFilter = symbolInfo.filters.find(
    (filter) => filter.filterType === "LOT_SIZE"
  );

  if (!lotSizeFilter) {
    return { valid: true };
  }

  const minQty = Number(lotSizeFilter.minQty);
  const maxQty = Number(lotSizeFilter.maxQty);
  const stepSize = Number(lotSizeFilter.stepSize);

  // Check minimum quantity
  if (quantity < minQty) {
    return {
      valid: false,
      error: `Quantity ${quantity} is below minimum ${minQty} for ${symbolInfo.symbol}`,
      adjustedQuantity: minQty,
    };
  }

  // Check maximum quantity
  if (quantity > maxQty) {
    return {
      valid: false,
      error: `Quantity ${quantity} exceeds maximum ${maxQty} for ${symbolInfo.symbol}`,
      adjustedQuantity: maxQty,
    };
  }

  // Check step size
  const remainder = (quantity - minQty) % stepSize;
  if (remainder !== 0) {
    const adjustedQuantity = minQty + Math.floor((quantity - minQty) / stepSize) * stepSize;
    return {
      valid: false,
      error: `Quantity must be in increments of ${stepSize}. Suggested: ${adjustedQuantity}`,
      adjustedQuantity,
    };
  }

  return { valid: true };
};

export const validateOrderPrice = (
  price: number,
  symbolInfo: SymbolInfo
): { valid: boolean; error?: string; adjustedPrice?: number } => {
  const priceFilter = symbolInfo.filters.find(
    (filter) => filter.filterType === "PRICE_FILTER"
  );

  if (!priceFilter) {
    return { valid: true };
  }

  const minPrice = Number(priceFilter.minPrice);
  const maxPrice = Number(priceFilter.maxPrice);
  const tickSize = Number(priceFilter.tickSize);

  // Check minimum price
  if (price < minPrice) {
    return {
      valid: false,
      error: `Price ${price} is below minimum ${minPrice} for ${symbolInfo.symbol}`,
      adjustedPrice: minPrice,
    };
  }

  // Check maximum price
  if (price > maxPrice) {
    return {
      valid: false,
      error: `Price ${price} exceeds maximum ${maxPrice} for ${symbolInfo.symbol}`,
      adjustedPrice: maxPrice,
    };
  }

  // Check tick size
  const remainder = (price - minPrice) % tickSize;
  if (remainder !== 0) {
    const adjustedPrice = minPrice + Math.floor((price - minPrice) / tickSize) * tickSize;
    return {
      valid: false,
      error: `Price must be in increments of ${tickSize}. Suggested: ${adjustedPrice}`,
      adjustedPrice,
    };
  }

  return { valid: true };
};