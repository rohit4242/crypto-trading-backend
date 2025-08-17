import { Hono } from "hono";

import { Spot, SpotRestAPI } from "@binance/spot";
import { validateApiCredentials } from "../middleware/validates.js";
import {
  BaseRequestSchema,
  CancelOrderSchema,
  CreateOrderRequestSchema,
  CreateOrderSchema,
  type ApiCredentials,
} from "../schemas/binance.js";
import { getCurrentPrice } from "../lib/utils.js";

const orders = new Hono();

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
    const validateData = CreateOrderRequestSchema.parse(body);
    const binance = new Spot({
      configurationRestAPI: validateData.credentials,
    });

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
