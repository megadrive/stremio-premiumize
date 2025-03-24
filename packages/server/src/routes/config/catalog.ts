import { createRouter } from "@/util/createHono.js";
import type { MetaDetail } from "stremio-addon-sdk";
import { fetchFolder } from "@/lib/premiumize.js";

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
      type: item.type === "folder" ? "series" : "movie",
    };
  });

  return c.json({ metas });
});
