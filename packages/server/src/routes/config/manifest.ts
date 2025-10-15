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
        "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..fzq4vqD9JBY5JZsjRDf-yQ.4z5MVPWOWwqqDDVN1r-M2AEfe0hj5EO5xu07C6MMQfFM9gzeZwOkdpTTfmSZ3qGYKVNvMo0rrhY4NIgQVNY7DeXdTAqRqj2efXAe6goqPiycgZBoTvM5d7HqdVCksUg6.wB2yNc5A3mga-_NEljyYAQ",
    },
  });

  // long-lived header
  c.header("Cache-Control", `max-age: ${SIX_MONTHS}`);

  return c.json(manifest);
});
