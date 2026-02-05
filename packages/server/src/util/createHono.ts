import { Hono } from "hono";
import { type Config } from "@stremio-addon/config";
import { pinoLoggerMiddleware } from "@/middleware/pinoLogger.js";
import { cors } from "hono/cors";
import type { PinoLogger } from "hono-pino";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { parseConfigFromUrl } from "@/middleware/parseConfigFromUrl.js";
import type { PremiumizeClient } from "@almosteffective/premiumize-api";

type AppBindings = {
  Variables: {
    logger: PinoLogger;
  };
};

export type AppBindingsWithConfig = AppBindings & {
  Variables: {
    config: Config;
    premiumize: PremiumizeClient;
  };
};

export function createApp() {
  return new Hono<AppBindings>({ strict: false })
    .use(serveEmojiFavicon("📺"))
    .use(pinoLoggerMiddleware())
    .use(cors())
    .onError(onError)
    .notFound(notFound);
}

/**
 * Create an API router
 */
export function createAPIRouter() {
  return new Hono<AppBindings>({ strict: false });
}

/**
 * Create a router with config /.+/(route)
 */
export function createRouter() {
  return new Hono<AppBindingsWithConfig>({ strict: false }).use(
    parseConfigFromUrl
  );
}
