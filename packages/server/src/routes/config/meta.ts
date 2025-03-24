import { fetchFolder } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import { addonManifest } from "@/util/manifest.js";
import type { MetaDetail, MetaLink } from "stremio-addon-sdk";

function isVideoFile(name: string) {
  return /\.(mp4|mkv|avi|mov|wmv|flv|webm|mpg|mpeg)$/i.test(name);
}

// should match: /:config/meta/:type/:id/:extras?.json
// ex: /configexample/meta/movie/123456.json
export const metaRouter = createRouter();

metaRouter.get("/:type/:id", async (c) => {
  // const type = c.req.param("type");
  const pid = c.req.param("id").split(".")[0];

  if (!pid) {
    return c.json({ meta: {}, error: "Missing id" }, 500);
  }

  const [, id] = pid.split(":");
  if (!id) {
    return c.json({ error: "Invalid id" }, 500);
  }

  const folder = await fetchFolder(c.var.config.premiumizeApiKey, id);
  if (!folder) {
    return c.json({ meta: {}, error: "Failed to fetch file info" }, 500);
  }

  const links: MetaLink[] = [];

  // if we are in a subfolder, add a link to the parent folder
  if (folder.parent_id && folder.name !== "root") {
    links.push({
      name: "^ Up a directory",
      category: "Navigation",
      url: `stremio:///detail/series/premiumize:${folder.parent_id}`,
    });
  }

  folder.content
    .filter((item) => item.type === "folder")
    .map((item) => {
      return {
        name: item.name,
        category: "Navigation",
        url: `stremio:///detail/series/premiumize:${item.id}`,
      };
    })
    .forEach((link) => links.push(link));

  if (folder.name === "root") {
    folder.name = "Premiumize Cloud";
  }

  const treatAsSeries = (folder.name ?? "").includes("#tv");
  c.var.logger.info(`Treating as series? ${treatAsSeries}`);
  const videos: MetaDetail["videos"] = [];
  if (treatAsSeries) {
    videos.push(
      // @ts-expect-error including "title" key breaks the whole thing.
      ...folder.content
        .filter((item) => item.type === "file" && isVideoFile(item.name))
        .map((item, idx) => {
          return {
            id: `premiumize:${item.id}:tv`,
            // title: item.name,
            name: item.name,
            season: 1,
            episode: idx + 1,
            released: new Date(item.created_at ?? Date.now()).toISOString(),
          };
        })
    );
  }

  const meta: MetaDetail = {
    id: `premiumize:${folder.folder_id}`,
    name: folder.name ?? "Unknown",
    description: `Path: ${folder.breadcrumbs?.map((crumb) => crumb.name).join(" > ")}`,
    releaseInfo: `${folder.content.length} item${folder.content.length !== 1 ? "s" : ""}`,
    links,
    type: addonManifest.types[0],
    videos,
  };

  return c.json({ meta });
});
