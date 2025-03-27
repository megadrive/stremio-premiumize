import type { AppBindingsWithConfig } from "@/util/createHono.js";
import { config } from "@stremio-addon/config";
import { createMiddleware } from "hono/factory";
import { FORBIDDEN } from "stoker/http-status-codes";
import { FORBIDDEN as FORBIDDEN_TEXT } from "stoker/http-status-phrases";

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const parseConfigFromUrl = createMiddleware<AppBindingsWithConfig>(
  async (c, next) => {
    const configString = c.req.param("config");

    try {
      if (configString) {
        const decode = await config.decode(configString);
        if (!decode.success) throw new ConfigError("Invalid config");
        c.set("config", decode.data);
      }
    } catch (error) {
      if (error instanceof Error) {
        c.var.logger.error(error);
      }
      c.text(FORBIDDEN_TEXT, FORBIDDEN);
    }

    await next();
  }
);
