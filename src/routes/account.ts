import { Hono } from "hono";

import { Spot } from "@binance/spot";
import { validateApiCredentials } from "../middleware/validates.js";
import { BaseRequestSchema } from "../schemas/binance.js";

const account = new Hono();

account.post("/balance", validateApiCredentials, async (c) => {
  try {
    const body = await c.req.json();
    const validateData = BaseRequestSchema.parse(body);
    const binance = new Spot({
        configurationRestAPI: validateData.credentials,
    });

    const response = await binance.restAPI.getAccount();
    const data = await response.data();
    return c.json({ message: "Account balance fetched successfully", data }, 200);
  } catch (error) {
    console.error("Error fetching account balance", error);
    return c.json({ message: "Error fetching account balance" }, 500);
  }
});


export default account;

