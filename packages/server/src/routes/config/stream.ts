import { prefix, subtitleExtensions } from "@/consts.js";
import { fetchFolder, itemDetails, search } from "@/lib/premiumize.js";
import type { Result } from "@/lib/result.type.js";
import { createRouter } from "@/util/createHono.js";
import { serverEnv } from "@stremio-addon/env";
import type { Stream, Subtitle } from "stremio-addon-sdk";
import { z } from "zod";

export const streamRouter = createRouter();

function testIsWebReady(item: { stream_link?: string | null }) {
  return item.stream_link && item.stream_link.endsWith(".mp4");
}

async function getIMDbInfo(
  imdbId: string,
  type: string
): Promise<Result<{ name: string; season?: string; episode?: string }>> {
  const [id, season, episode] =
    type === "series" ? imdbId.split(":") : [imdbId];

  try {
    console.debug(
      `Fetching IMDb info for ${type} with ID ${id} (season: ${season}, episode: ${episode})`
    );
    const cinemetaResponse = await fetch(
      `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`
    );

    if (!cinemetaResponse.ok) {
      throw new Error("Bad response from Cinemeta", {
        cause: "getIMDbInfo:fetch",
      });
    }

    const json = await cinemetaResponse.json();

    const cinemeta = z
      .object({
        meta: z.object({
          imdb_id: z.string(),
          name: z.string(),
        }),
      })
      .safeParse(json);

    if (!cinemeta.success) {
      throw new Error("Invalid response from Cinemeta", {
        cause: "getIMDbInfo:parseResponse",
      });
    }

    return {
      success: true,
      data: {
        name: cinemeta.data.meta.name,
        season,
        episode,
      },
    };
  } catch (error) {
    console.error("Error fetching Cinemeta data:", error);
    return { success: false, message: "Failed to fetch Cinemeta data" };
  }
}

streamRouter.get("/:type/:id", async (c) => {
  // removes .json
  const pid = c.req.param("id").split(".")[0];

  if (!pid) {
    return c.json({ meta: {}, error: "Missing id" }, 500);
  }

  if (pid.startsWith("tt")) {
    const imdbInfo = await getIMDbInfo(pid, c.req.param("type"));
    if (!imdbInfo.success) {
      return c.json({ meta: {}, error: "Failed to fetch IMDb info" }, 500);
    }
    const { name, season, episode } = imdbInfo.data;

    // do a search in premiumize
    // pad with a 0 if less than 10
    const paddedSeason = season ? `S${season.padStart(2, "0")}` : undefined;
    const paddedEpisode = episode ? `E${episode.padStart(2, "0")}` : undefined;
    const searchResults = await search(
      c.var.config.premiumizeApiKey,
      `${name} ${paddedSeason ?? ""} ${paddedEpisode ?? ""}`.trim()
    );

    if (!searchResults?.success) {
      return c.json({ meta: {}, error: "Failed to fetch search results" }, 500);
    }
    const searchResult = searchResults.data;
    if (searchResult.content.length === 0) {
      return c.json({ meta: {}, error: "No results found" }, 500);
    }

    const streams: Stream[] = [];
    const detailPromises = await Promise.allSettled(
      searchResult.content.map(async (item) => {
        const itemResult = await itemDetails(
          c.var.config.premiumizeApiKey,
          item.id
        );

        if (!itemResult.success) {
          return undefined;
        }

        const details = itemResult.data;
        if (details.type !== "file") {
          return undefined;
        }

        // get the parent folder
        const parent = await fetchFolder(
          c.var.config.premiumizeApiKey,
          details.folder_id
        );

        let subtitles: Subtitle[] = [];
        if (parent.success) {
          c.var.logger.debug(`Parent folder found: ${parent.data.name}`);
          // find subtitles for the file
          subtitles = parent.data.content
            .filter((file) => {
              const ext = file.name.split(".").pop();
              return (
                file.type === "file" &&
                ext &&
                subtitleExtensions.includes(ext) &&
                file.link
              );
            })
            .map(function toSubtitle(file) {
              const match = file.name.match(/^.*\.(\w{3})\.(srt|vtt)$/i);
              if (!match) {
                c.var.logger.warn(
                  `Subtitle file ${file.name} does not match a language code, using default (eng)`
                );
                return {
                  id: `${prefix}:${file.id}:subtitle`,
                  url: file.link ?? "",
                  lang: "eng",
                };
              }
              return {
                id: `${prefix}:${file.id}:subtitle`,
                url: file.link ?? "",
                lang: match[1],
              };
            });
        }

        const stream: Stream = {
          title: `${details.stream_link ? "⚡ " : ""}${details.name}`,
          url: details.stream_link ?? details.link,
          subtitles,
          behaviorHints: {
            notWebReady: !testIsWebReady(details),
          },
        };
        return stream;
      })
    );

    detailPromises.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        streams.push(result.value);
      }
    });

    return c.json({ streams });
  }

  // removes premiumize: prefix
  const [, id, special] = pid.split(":");
  if (!id) {
    return c.json({ error: "Invalid id" }, 500);
  }

  // handle #tv shows
  if (special && special.toLowerCase() === "tv") {
    // fetch the item directly
    const itemResult = await itemDetails(c.var.config.premiumizeApiKey, id);
    if (!itemResult.success) {
      return c.json({ meta: {}, error: "Failed to fetch item" }, 500);
    }
    const item = itemResult.data;
    const stream: Stream = {
      title: `${item.stream_link ? "⚡ " : ""}${item.name}`,
      url: item.stream_link ?? item.link,
      behaviorHints: {
        notWebReady: !testIsWebReady(item),
      },
    };
    return c.json({ streams: [stream] });
  }

  if (special && special.toLowerCase() === "video") {
    // fetch the item directly
    const itemResult = await itemDetails(c.var.config.premiumizeApiKey, id);
    if (!itemResult.success) {
      return c.json({ meta: {}, error: "Failed to fetch item" }, 500);
    }
    const item = itemResult.data;
    const stream: Stream = {
      title: `${item.stream_link ? "⚡ " : ""}${item.name}`,
      url: item.stream_link ?? item.link,
      behaviorHints: {
        notWebReady: !testIsWebReady(item),
      },
    };
    return c.json({ streams: [stream] });
  }

  const folderResult = await fetchFolder(c.var.config.premiumizeApiKey, id);
  if (!folderResult?.success) {
    return c.json({ meta: {}, error: "Failed to fetch folder" }, 500);
  }
  const folder = folderResult.data;

  let folderStreams: Stream[] = [];
  c.var.logger.debug(c.var.config);
  if (c.var.config.navigationViaStreamLinks) {
    c.var.logger.info("Stream links for navigation ENABLED");
    folderStreams = [
      {
        title: "^ Up a directory",
        externalUrl: `stremio:///detail/series/${prefix}:${folder.parent_id}`,
      },
      ...folder.content
        .filter((item) => item.type === "folder")
        .map((item) => {
          return {
            externalUrl: `stremio:///detail/series/${prefix}:${item.id}`,
            title: item.name,
          };
        }),
    ];
  }

  const videoStreams: Stream[] = folder.content
    .filter((item) => {
      return item.link || item.stream_link;
    })
    .filter((item) => {
      // remove non-video files
      return (
        item.type === "file" &&
        ["mp4", "mov", "avi", "mkv", "webm", "wmv", "flv"].includes(
          item.name.split(".").pop() ?? ""
        )
      );
    })
    .map((item) => {
      // see if there's a subtitle file in the same folder with the same name
      const fileName = item.name.split(".").slice(0, -1).join(".");
      const subtitle = folder.content.find((file) => {
        const name = file.name.split(".").slice(0, -1).join(".");
        console.info(`comparing ${fileName} with ${name}`);
        if (file.id !== item.id && name === fileName) {
          return true;
        }
      });

      const subtitles: Subtitle[] = [];
      if (subtitle) {
        // early exit if we don't the right props
        if (!subtitle.link || !subtitle.name) {
          return;
        }
        subtitles.push({
          id: subtitle.id,
          url: subtitle.link,
          lang: "eng",
        });
      }

      // type guard
      if (!item.link && !item.stream_link) {
        return;
      }

      const isWebReady = testIsWebReady(item);

      return {
        id: `${prefix}:${item.id}`,
        title: item.name,
        type: item.type === "folder" ? "series" : "movie",
        url: item.stream_link ?? item.link,
        subtitles,
        behaviorHints: {
          notWebReady: !isWebReady,
        },
      };
    })
    .filter((stream) => !!stream);

  // if no streams, output an error that will open the github
  if (videoStreams.length === 0) {
    c.var.logger.info("No streamable files found");
    const error: Stream = {
      name: `Premiumize Library ${serverEnv.isDevelopment ? "(dev)" : ""}`,
      title:
        "No streamable files found,\nif you think this is an error,\nplease open an issue\non GitHub by selecting this.",
      externalUrl: "https://github.com/megadrive/stremio-premiumize",
    };
    videoStreams.push(error);
  }

  return c.json({ streams: [...folderStreams, ...videoStreams] });
});
