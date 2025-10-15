import { prefix } from "@/consts.js";
import { createRouter } from "@/util/createHono.js";
import { addonManifest, createManifest } from "@/util/manifest.js";

const SIX_MONTHS = 60 * 60 * 24 * 30 * 6;

export const manifestRouter = createRouter();

/**
 * This endpoint gets your user's configuration and is considered the "final" manifest, configured by the user.
 *
 * This is where you can do things like dynamically create catalogs based on the user config provided by `config`,
 * or request certain resources.
 *
 * @configurable-manifest
 * Search: @configuration in packages/config to change the configuration.
 */
manifestRouter.get("/", async (c) => {
  // just need to clone the object to avoid mutation, all config is in the `config` variable
  const manifest = createManifest({
    ...addonManifest,
    idPrefixes: [`${prefix}:`],
    logo: `${c.var.config.baseUrl}/logo.png`,
    // @ts-expect-error - stremio-addons.net verification
    stremioAddonsConfig: {
      issuer: "https://stremio-addons.net",
      signature:
        "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..EwvsQZVLc0DqlifEiTI_GQ.oF-cEJiXs0x0I2BrVgU9iwPcXknAvYV9OxI2tsxaA3tLyCRA1NzLnkWxbNRMiuQK1esOqAzXslxJwfm4Hy3W5Frzlpwtt2X26P0z6121Ga_2MpfZNfrF3lIVPWyZZ6rR.HZPw-F1Qc3A7wPBetRsWSA",
    },
  });

  // long-lived header
  c.header("Cache-Control", `max-age: ${SIX_MONTHS}`);

  return c.json(manifest);
});
