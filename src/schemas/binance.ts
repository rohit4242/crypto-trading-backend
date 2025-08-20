import { z } from "zod";

export const ApiCredentialsSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
});

// Order Creation Schema
export const CreateOrderSchema = z
  .object({
    symbol: z.string().min(1, "Symbol is required").toUpperCase(),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["LIMIT", "MARKET"]),
    // Accept numeric strings to avoid float issues; optional depending on type
    quantity: z.string().optional(),
    quoteOrderQty: z.string().optional(),
    price: z.string().optional(),
    timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
  })
  .refine(
    (data) => {
      if (data.type === "MARKET") {
        // Allow either quantity OR quoteOrderQty for MARKET orders
        return !!(data.quantity || data.quoteOrderQty);
      }
      if (data.type === "LIMIT") {
        // LIMIT orders must include both quantity and price
        return !!(data.quantity && data.price);
      }
      return true;
    },
    {
      message:
        "For MARKET orders, provide quantity or quoteOrderQty. For LIMIT orders, provide both quantity and price.",
    }
  );

// Cancel Order Schema
export const CancelOrderSchema = z.object({
  credentials: ApiCredentialsSchema,
  symbol: z.string().min(1, "Symbol is required"),
  orderId: z.string().min(1, "Order ID is required"),
});

// Get Order Schema
export const GetOrderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  orderId: z.string().min(1, "Order ID is required"),
});

// Base Request Schema
export const BaseRequestSchema = z.object({
  credentials: ApiCredentialsSchema,
});

export const CreateOrderRequestSchema = BaseRequestSchema.extend({
  order: CreateOrderSchema,
});

// Type exports
export type ApiCredentials = z.infer<typeof ApiCredentialsSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type CancelOrder = z.infer<typeof CancelOrderSchema>;
export type GetOrder = z.infer<typeof GetOrderSchema>;
