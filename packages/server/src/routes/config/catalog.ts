import { createRouter } from "@/util/createHono.js";
import type { MetaDetail } from "stremio-addon-sdk";
import { fetchFolder, search as searchRemote } from "@/lib/premiumize.js";
import { addonManifest } from "@/util/manifest.js";

export const catalogRouter = createRouter();

// id = "premiumize:id"
catalogRouter.get("/:type/:id.json", async (c) => {
  // fetch the folder contents
  const folder = await fetchFolder(c.var.config.premiumizeApiKey);

  if (!folder) {
    return c.json({ error: "Failed to fetch folder" });
  }

  const metas: MetaDetail[] = folder.content.map((item) => {
    return {
      id: `premiumize:${item.id}`,
      name: item.name,
      type: addonManifest.types[0],
    };
  });

  return c.json({ metas });
});

catalogRouter.get("/:type/:id/:search", async (c) => {
  const search = c.req.param("search")?.split(".").slice(0, -1).join(".");

  if (!search) {
    return c.json({ metas: [], error: "Missing search" });
  }

  const [, q] = search.split("=");

  try {
    const results = await searchRemote(c.var.config.premiumizeApiKey, q);
    if (!results) {
      throw new Error("Failed to search");
    }

    const metas: MetaDetail[] = results.content.map((item) => {
      const icon = item.type === "file" ? "📺" : "📂";

      return {
        id: `premiumize:${item.id}`,
        name: `${icon} ${item.name}`,
        type: addonManifest.types[0],
        poster: `http://localhost:4321/api/icon/${icon}`,
        behaviourHints: {
          defaultVideo:
            item.type === "file" ? `premiumize:${item.id}` : undefined,
        },
      };
    });

    return c.json({ metas });
  } catch (error) {
    c.var.logger.error(error);
  }

  return c.json({ metas: [] });
});
