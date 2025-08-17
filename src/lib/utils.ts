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
