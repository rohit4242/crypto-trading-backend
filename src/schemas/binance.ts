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
    quantity: z.string().min(1, "Quantity is required").optional(),
    quoteOrderQty: z
      .string()
      .min(1, "Quote order quantity is required for MARKET orders")
      .optional(),
    price: z.string().optional(),
    timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
  })
  .refine(
    (data) => {
      if (data.type === "MARKET") {
        return data.quoteOrderQty !== undefined;
      }
      if (data.type === "LIMIT") {
        return data.quantity !== undefined && data.price !== undefined;
      }
      return true;
    },
    {
      message:
        "For MARKET orders, quoteOrderQty is required. For LIMIT orders, both quantity and price are required.",
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
