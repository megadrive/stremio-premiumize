import { createRouter } from "@/util/createHono.js";
import type { MetaDetail } from "stremio-addon-sdk";
import { fetchFolder, search as searchRemote } from "@/lib/premiumize.js";
import { addonManifest } from "@/util/manifest.js";
import { prefix } from "@/consts.js";
import isVideoFile from "@/util/isVideoFile.js";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "stoker/http-status-codes";

export const catalogRouter = createRouter();

function prependIconToItemName(
  name: string,
  type: "file" | "folder"
): { name: string; icon: string } {
  const icon = type === "file" ? "📺" : "📂";
  return {
    name: `${icon} ${name}`,
    icon,
  };
}

function removeTags(name: string): string {
  return name.replace(/#.+/g, "").trim();
}

// id = "premiumize:id"
catalogRouter.get("/:type/:id.json", async (c) => {
  // fetch the folder contents
  const folderResult = await fetchFolder(c.var.config.premiumizeApiKey);

  if (!folderResult?.success) {
    return c.json({ error: "Failed to fetch folder" }, INTERNAL_SERVER_ERROR);
  }

  const folder = folderResult.data;

  const metas: MetaDetail[] = folder.content
    .filter((item) => item.type === "folder" || isVideoFile(item.name))
    .map((item) => {
      const { name, icon } = prependIconToItemName(item.name, item.type);

      return {
        id: `${prefix}:${item.id}`,
        name: c.var.config.hideFolderTags ? removeTags(name) : name,
        type: addonManifest.types[0],
        poster: `${c.var.config.baseUrl}/api/icon/${icon}/poster`,
      };
    });

  return c.json({ metas });
});

catalogRouter.get("/:type/:id/:search", async (c) => {
  const search = c.req.param("search")?.split(".").slice(0, -1).join(".");

  if (!search) {
    return c.json({ metas: [], error: "Missing search" }, NOT_FOUND);
  }

  const [, q] = search.replace(`.json$`, "").split("=");

  try {
    const searchResultResult = await searchRemote(
      c.var.config.premiumizeApiKey,
      q
    );
    if (!searchResultResult?.success) {
      throw new Error("Failed to search");
    }

    const searchResult = searchResultResult.data;

    const metas: MetaDetail[] = searchResult.content
      .filter((item) => item.type === "folder" || isVideoFile(item.name))
      .map((item) => {
        const { name, icon } = prependIconToItemName(item.name, item.type);

        return {
          id: `${prefix}:${item.id}`,
          name: c.var.config.hideFolderTags ? removeTags(name) : name,
          type: addonManifest.types[0],
          poster: `${c.var.config.baseUrl}/api/icon/${icon}/poster`,
          behaviourHints: {
            defaultVideo:
              item.type === "file" ? `${prefix}:${item.id}` : undefined,
          },
        };
      });

    return c.json({ metas });
  } catch (error) {
    c.var.logger.error(error);
  }

  return c.json({ metas: [] }, NOT_FOUND);
});
