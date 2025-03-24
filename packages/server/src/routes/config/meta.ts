import { fetchFolder } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import type { MetaDetail, MetaLink } from "stremio-addon-sdk";

// should match: /:config/meta/:type/:id/:extras?.json
// ex: /configexample/meta/movie/123456.json
export const metaRouter = createRouter();

metaRouter.get("/:type/:id", async (c) => {
  const type = c.req.param("type");
  const pid = c.req.param("id").split(".")[0];

  if (!pid) {
    return c.json({ meta: {}, error: "Missing id" }, 500);
  }

  const [, id] = pid.split(":");
  if (!id) {
    return c.json({ error: "Invalid id" }, 500);
  }

  console.info({ type, id });

  const folder = await fetchFolder(c.var.config.premiumizeApiKey, id);
  if (!folder) {
    return c.json({ meta: {}, error: "Failed to fetch file info" }, 500);
  }

  const links: MetaLink[] = folder.content
    .filter((item) => item.type === "folder")
    .map((item) => {
      return {
        name: item.name,
        category: "Subfolder",
        url: `stremio:///detail/series/premiumize:${item.id}.json`,
      };
    });

  const meta: MetaDetail = {
    id: `premiumize:${folder.folder_id}`,
    name: folder.name ?? "Unknown",
    description: `Path: ${folder.breadcrumbs?.map((crumb) => crumb.name).join(" > ")}`,
    releaseInfo: `${folder.content.length} items`,
    links,
    type: "series",
  };

  return c.json({ meta });
});
