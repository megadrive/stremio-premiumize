import { fetchFolder, itemDetails } from "@/lib/premiumize.js";
import { fetchFolderSettings } from "@/lib/helpers.js";
import { createRouter } from "@/util/createHono.js";
import { addonManifest } from "@/util/manifest.js";
import type { MetaDetail, MetaLink, MetaVideo } from "stremio-addon-sdk";
import { prefix } from "@/consts.js";

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

  const folderResult = await fetchFolder(c.var.config.premiumizeApiKey, id);
  if (!folderResult?.success) {
    // it may be a file, so try to fetch it
    const fileResult = await itemDetails(c.var.config.premiumizeApiKey, id);
    if (fileResult?.success) {
      const file = fileResult.data;
      const meta: MetaDetail = {
        id: `${prefix}:${file.id}`,
        name: file.name,
        description: file.name,
        releaseInfo: `Size: ${file.size}`,
        // we know it's a single video file, but we need to treat it as a series
        type: "series",
        videos: [
          {
            id: `${prefix}:${file.id}:video`,
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
  const folder = folderResult.data;
  if (folder.parent_id && folder.name !== "root") {
    links.push({
      name: "^ Up a directory",
      category: "Navigation",
      url: `stremio:///detail/series/${prefix}:${folder.parent_id}`,
    });
  }

  folder.content
    .filter((item) => item.type === "folder")
    .map((item) => {
      return {
        name: item.name,
        category: "Navigation",
        url: `stremio:///detail/series/${prefix}:${item.id}`,
      };
    })
    .forEach((link) => links.push(link));

  if (folder.name === "root") {
    folder.name = "Premiumize Cloud";
  }

  // Get folder settings
  const folderSettings = await fetchFolderSettings(
    c.var.config.premiumizeApiKey,
    id
  );
  const treatAsSeries = folderSettings.success && folderSettings.data.tv;
  c.var.logger.info(`Treating as series? ${treatAsSeries}`);
  let videos: MetaDetail["videos"] = [];
  if (treatAsSeries) {
    /*
      If the folder is a series, we need to treat it as such.
      This means that we need to:
      - Get all the video files in the folder
      - Extract the season and episode number from the file name
      - Create a MetaVideo object for each file
     */
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
            id: `${prefix}:${item.id}:tv`,
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

  const folderCount = folder.content.filter(
    (item) => item.type === "folder"
  ).length;
  const fileCount = folder.content.filter(
    (item) => item.type === "file"
  ).length;
  const pluralise = (word: string, count: number) => {
    return `${word}${count === 1 ? "" : "s"}`;
  };

  const folderText = `${folderCount} ${pluralise("folder", folderCount)}`;

  const fileText = `${folderCount} ${pluralise("file", fileCount)}`;

  const meta: MetaDetail = {
    id: `${prefix}:${folder.folder_id}`,
    name: folder.name?.replace(/#.+$/gi, "").trim() ?? "Unknown",
    description: `Path: ${folder.breadcrumbs?.map((crumb) => crumb.name).join(" > ")}`,
    releaseInfo: `${[folderText, fileText].join(" | ")}`,
    links,
    type: addonManifest.types[0],
    videos,
  };

  return c.json({ meta });
});
