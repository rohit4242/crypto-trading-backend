import type { Context, Next } from "hono";

export const validateApiCredentials = async (c: Context, next: Next) => {
  try {
    console.log("Start validating API credentials");
    const body = await c.req.json();
    console.log("Body", body);
    if (!body.credentials.apiKey || !body.credentials.apiSecret) {
      return c.json({ error: "API key and API secret are required" }, 400);
    }

    if (body.credentials.apiKey.length !== 64 || body.credentials.apiSecret.length !== 64) {
      return c.json(
        { error: "API key and API secret must be 64 characters long" },
        400
      );
    }
    console.log("API credentials validated successfully");
    await next();
  } catch (error) {
    console.error("Error validating API credentials", error);
    return c.json({ error: "Invalid request body" }, 400);
  }
};
