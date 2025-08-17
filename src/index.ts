import { serve } from "@hono/node-server";
import { Hono } from "hono";
import orders from "./routes/orders.js";
import account from "./routes/account.js";
import { cors } from "hono/cors";

const app = new Hono();
// cors
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Orders API
app.route("/orders", orders);

// Account API
app.route("/account", account);

serve(
  {
    fetch: app.fetch,
    port: 4000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
