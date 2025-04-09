import { serverEnv } from "@stremio-addon/env";

export const prefix = serverEnv.isProduction ? "premiumize" : "premiumize-dev";

export const subtitleExtensions = ["srt", "vtt"];
