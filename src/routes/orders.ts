import { Hono } from "hono";
import { z } from "zod";

import { Spot, SpotRestAPI } from "@binance/spot";
import { validateApiCredentials } from "../middleware/validates.js";
import {
  BaseRequestSchema,
  CancelOrderSchema,
  CreateOrderRequestSchema,
  CreateOrderSchema,
  type ApiCredentials,
} from "../schemas/binance.js";
import { getCurrentPrice, getSymbolInfo, validateOrderQuantity, validateOrderPrice } from "../lib/utils.js";

const orders = new Hono();

// Get trading rules for a symbol
orders.post("/symbol-info", validateApiCredentials, async (c) => {
  try {
    const body = await c.req.json();
    const validateData = BaseRequestSchema.extend({
      symbol: z.string().min(1, "Symbol is required").toUpperCase(),
    }).parse(body);

    const symbolInfo = await getSymbolInfo(validateData.symbol, validateData.credentials);
    if (!symbolInfo) {
      return c.json({ message: "Symbol not found" }, 404);
    }

    // Extract relevant filters for frontend
    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === "LOT_SIZE");
    const priceFilter = symbolInfo.filters.find(f => f.filterType === "PRICE_FILTER");
    const minNotionalFilter = symbolInfo.filters.find(f => f.filterType === "MIN_NOTIONAL");

    return c.json({
      symbol: symbolInfo.symbol,
      baseAsset: symbolInfo.baseAsset,
      quoteAsset: symbolInfo.quoteAsset,
      baseAssetPrecision: symbolInfo.baseAssetPrecision,
      quoteAssetPrecision: symbolInfo.quoteAssetPrecision,
      filters: {
        lotSize: lotSizeFilter ? {
          minQty: Number(lotSizeFilter.minQty),
          maxQty: Number(lotSizeFilter.maxQty),
          stepSize: Number(lotSizeFilter.stepSize),
        } : null,
        priceFilter: priceFilter ? {
          minPrice: Number(priceFilter.minPrice),
          maxPrice: Number(priceFilter.maxPrice),
          tickSize: Number(priceFilter.tickSize),
        } : null,
        minNotional: minNotionalFilter ? Number(minNotionalFilter.minNotional) : null,
      }
    }, 200);
  } catch (error) {
    console.error("Error fetching symbol info", error);
    return c.json({ message: "Error fetching symbol info" }, 500);
  }
});

interface orderParams {
  symbol: string;
  side: SpotRestAPI.NewOrderSideEnum;
  type: SpotRestAPI.NewOrderTypeEnum;
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  timeInForce?: SpotRestAPI.NewOrderTimeInForceEnum;
}

// Helper function to build market order parameters
function buildMarketOrderParams(orderData: any): Partial<orderParams> {
  const params: Partial<orderParams> = {};

  if (orderData.side === SpotRestAPI.NewOrderSideEnum.BUY) {
    if (orderData.quoteOrderQty) {
      params.quoteOrderQty = Number(orderData.quoteOrderQty);
    } else if (orderData.quantity) {
      params.quantity = Number(orderData.quantity);
    }
  } else {
    // For market sell, only use quantity (amount to sell)
    if (orderData.quantity) {
      params.quantity = Number(orderData.quantity);
    }
  }

  return params;
}

async function buildLimitOrderParams(
  orderData: any,
  credentials: ApiCredentials
): Promise<Partial<orderParams>> {
  const params: Partial<orderParams> = {};
  // Set Price
  if (orderData.price) {
    params.price = Number(orderData.price);
  } else {
    const currentPrice = await getCurrentPrice(orderData.symbol, credentials);
    if (orderData.side === SpotRestAPI.NewOrderSideEnum.BUY) {
      params.price = currentPrice * 0.99;
    } else {
      params.price = currentPrice * 1.01;
    }
  }

  // Set Quantity
  if (orderData.quantity) {
    params.quantity = Number(orderData.quantity);
  } else if (orderData.quoteOrderQty) {
    // Calculate quantity based on quote amount and price
    params.quantity = Number(orderData.quoteOrderQty) / params.price;
  }

  params.timeInForce = SpotRestAPI.NewOrderTimeInForceEnum.GTC;

  return params;
}

// Test API Credentials
orders.get("/test", validateApiCredentials, async (c) => {
  try {
    const body = await c.req.json();

    const validateData = BaseRequestSchema.parse(body);
    const binance = new Spot({
      configurationRestAPI: validateData.credentials,
    });

    const response = await binance.restAPI.ping();
    const data = await response.data();

    return c.json({ message: "API credentials are valid", data }, 200);
  } catch (error) {
    console.error("Error testing API credentials", error);
    return c.json({ message: "Error testing API credentials" }, 500);
  }
});

orders.post("/create", validateApiCredentials, async (c) => {
  try {
    const body = await c.req.json();
    console.log("Body", body);
    const validateData = CreateOrderRequestSchema.parse(body);
    const binance = new Spot({
      configurationRestAPI: validateData.credentials,
    });

    // Get symbol information for validation
    const symbolInfo = await getSymbolInfo(validateData.order.symbol, validateData.credentials);
    if (!symbolInfo) {
      return c.json({ message: "Invalid trading symbol" }, 400);
    }

    // Base Order Parameters
    const order: orderParams = {
      symbol: validateData.order.symbol,
      side: validateData.order.side as SpotRestAPI.NewOrderSideEnum,
      type: validateData.order.type as SpotRestAPI.NewOrderTypeEnum,
    };

    let additionalParams: Partial<orderParams> = {};

    if (validateData.order.type === SpotRestAPI.NewOrderTypeEnum.MARKET) {
      additionalParams = buildMarketOrderParams(validateData.order);
    } else if (validateData.order.type === SpotRestAPI.NewOrderTypeEnum.LIMIT) {
      additionalParams = await buildLimitOrderParams(
        validateData.order,
        validateData.credentials
      );
    } else {
      return c.json({ message: "Invalid order type" }, 400);
    }

    Object.assign(order, additionalParams);

    // Validate order quantity
    if (order.quantity) {
      const quantityValidation = validateOrderQuantity(order.quantity, symbolInfo);
      if (!quantityValidation.valid) {
        return c.json({
          message: "Order validation failed",
          error: quantityValidation.error,
          suggestion: quantityValidation.adjustedQuantity
            ? `Consider using quantity: ${quantityValidation.adjustedQuantity}`
            : undefined,
        }, 400);
      }
    }

    // Validate order price for limit orders
    if (order.price && validateData.order.type === SpotRestAPI.NewOrderTypeEnum.LIMIT) {
      const priceValidation = validateOrderPrice(order.price, symbolInfo);
      if (!priceValidation.valid) {
        return c.json({
          message: "Order validation failed",
          error: priceValidation.error,
          suggestion: priceValidation.adjustedPrice
            ? `Consider using price: ${priceValidation.adjustedPrice}`
            : undefined,
        }, 400);
      }
    }

    // Create the order
    const response = await binance.restAPI.newOrder({
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      quoteOrderQty: order.quoteOrderQty,
      price: order.price,
      timeInForce: order.timeInForce,
    });

    const data = await response.data();
    return c.json({ message: "Order created successfully", data }, 200);
  } catch (error) {
    console.error("Error creating order", error);
    return c.json({ message: "Error creating order" }, 500);
  }
});

orders.delete("/cancel", validateApiCredentials, async (c) => {
  try {
    const body = await c.req.json();
    const validateData = CancelOrderSchema.parse(body);
    const binance = new Spot({
      configurationRestAPI: validateData.credentials,
    });

    const response = await binance.restAPI.deleteOrder({
      symbol: validateData.symbol,
      orderId: Number(validateData.orderId),
    });

    const data = await response.data();
    return c.json({ message: "Order canceled successfully", data }, 200);
  } catch (error) {
    console.error("Error canceling order", error);
    return c.json({ message: "Error canceling order" }, 500);
  }
});

export default orders;
