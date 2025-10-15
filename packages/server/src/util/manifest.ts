import { prefix } from "@/consts.js";
import { serverEnv } from "@stremio-addon/env";
import type { Manifest } from "stremio-addon-sdk";

type ManifestExtended = Manifest & {
  stremioAddonsConfig?: {
    issuer: string;
    signature: string;
  };
};

/**
 * The manifest base of the addon.
 *
 * This gets cloned and modified when a user installs the addon in server.
 *
 * ! You do not have to edit anything in this object.
 */
const manifestBase: ManifestExtended = {
  id: "",
  name: "",
  description: "",
  version: "",
  catalogs: [],
  resources: ["meta"],
  types: ["movie", "series"],
};

/**
 * Create a new manifest.
 * NOTE: Remember that each "call" to your addon runs in isolation. There is no "app state" aside from the config sent in the URL.
 */
export const createManifest = (
  opts: Partial<Manifest> = {}
): ManifestExtended => {
  return {
    ...manifestBase,
    ...opts,
  };
};

/**
 * ? Addon configuration
 *
 * This is where you can give your addon an id, display name, etc. Essentially anything that will not change when the addon is updated.
 * You can do cool things like dynamically create catalogs, or request certain resources. You do that in the line marked: @configurable-manifest
 */
export const addonManifest = createManifest({
  id: `${serverEnv.isDevelopment ? "dev." : ""}megadrive.premiumize-library`,
  name: `Premiumize Library${serverEnv.isDevelopment ? " (dev)" : ""}`,
  version: `1.0.0${serverEnv.isDevelopment ? "-dev" : ""}`,
  description: "Access your Premiumize cloud library",
  types: ["series"],
  logo: `${serverEnv.BASE_URL}/logo.png`,
  resources: [
    "meta",
    "catalog",
    {
      name: "stream",
      types: ["movie", "series"],
      // override to grab on every ID, not just "premiumize:" links
      idPrefixes: [""],
    },
    "subtitles",
  ],
  catalogs: [
    {
      id: "library",
      // @ts-expect-error custom type
      type: `premiumize${serverEnv.isDevelopment ? "-dev" : ""}`,
      name: "Premiumize Library",
      extra: [
        {
          name: "search",
          isRequired: false,
        },
      ],
    },
  ],
  idPrefixes: [`${prefix}:`],
  stremioAddonsConfig: {
    issuer: "https://stremio-addons.net",
    signature:
      "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..fzq4vqD9JBY5JZsjRDf-yQ.4z5MVPWOWwqqDDVN1r-M2AEfe0hj5EO5xu07C6MMQfFM9gzeZwOkdpTTfmSZ3qGYKVNvMo0rrhY4NIgQVNY7DeXdTAqRqj2efXAe6goqPiycgZBoTvM5d7HqdVCksUg6.wB2yNc5A3mga-_NEljyYAQ",
  },
});
