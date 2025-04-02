import { fetchFolder, itemDetails } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import { addonManifest } from "@/util/manifest.js";
import type { MetaDetail, MetaLink, MetaVideo } from "stremio-addon-sdk";

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
    // it may be a file, so try to fetch it
    const file = await itemDetails(c.var.config.premiumizeApiKey, id);
    if (file) {
      const meta: MetaDetail = {
        id: `premiumize:${file.id}`,
        name: file.name,
        description: file.name,
        releaseInfo: `Size: ${file.size}`,
        // we know it's a single video file, but we need to treat it as a series
        type: "series",
        videos: [
          {
            id: `premiumize:${file.id}:video`,
            // @ts-expect-error name is a new prop
            name: file.name,
            released: new Date(file.created_at ?? Date.now()).toISOString(),
            available: true,
            rating: "0",
            season: 0,
            episode: 1,
          },
        ],
      };
      return c.json({ meta });
    }

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

  // TODO: Work out a better way to determine if this is a series
  const treatAsSeries = (folder.name ?? "").includes("#tv");
  c.var.logger.info(`Treating as series? ${treatAsSeries}`);
  let videos: MetaDetail["videos"] = [];
  if (treatAsSeries) {
    videos = videos.concat(
      ...folder.content
        .filter((item) => item.type === "file" && isVideoFile(item.name))
        .map((item, idx) => {
          let season = 0; // special
          let episode = idx + 1;

          const matchSeason = item.name.match(/s(\d+)/i);
          if (matchSeason) {
            season = parseInt(matchSeason[1], 10);
          }

          const matchEpisode = item.name.match(/e(\d+)/i);
          if (matchEpisode) {
            episode = parseInt(matchEpisode[1], 10);
          }

          const meta: MetaVideo = {
            id: `premiumize:${item.id}:tv`,
            // @ts-expect-error name is a new prop
            name: item.name,
            season,
            episode,
            available: true,
          };
          return meta;
        })
    );
  }

  const meta: MetaDetail = {
    id: `premiumize:${folder.folder_id}`,
    name: folder.name?.replace(/#.+$/gi, "").trim() ?? "Unknown",
    description: `Path: ${folder.breadcrumbs?.map((crumb) => crumb.name).join(" > ")}`,
    releaseInfo: `${folder.content.length} item${folder.content.length !== 1 ? "s" : ""}`,
    links,
    type: addonManifest.types[0],
    videos,
  };

  return c.json({ meta });
});
