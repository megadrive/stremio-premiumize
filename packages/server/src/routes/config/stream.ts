import { fetchFolder, itemDetails } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import { serverEnv } from "@stremio-addon/env";
import type { Stream, Subtitle } from "stremio-addon-sdk";

export const streamRouter = createRouter();

function testIsWebReady(item: { stream_link?: string | null }) {
  return item.stream_link && item.stream_link.endsWith(".mp4");
}

streamRouter.get("/:type/:id", async (c) => {
  // removes .json
  const pid = c.req.param("id").split(".")[0];

  if (!pid) {
    return c.json({ meta: {}, error: "Missing id" }, 500);
  }

  // removes premiumize: prefix
  const [, id, isTvShow] = pid.split(":");
  if (!id) {
    return c.json({ error: "Invalid id" }, 500);
  }

  // handle #tv shows
  if (isTvShow && isTvShow.toLowerCase() === "tv") {
    // fetch the item directly
    const item = await itemDetails(c.var.config.premiumizeApiKey, id);
    if (!item) {
      return c.json({ meta: {}, error: "Failed to fetch item" }, 500);
    }
    const stream: Stream = {
      title: `${item.stream_link ? "⚡ " : ""}${item.name}`,
      url: item.stream_link ?? item.link,
      behaviorHints: {
        notWebReady: !testIsWebReady(item),
      },
    };
    return c.json({ streams: [stream] });
  }

  const folder = await fetchFolder(c.var.config.premiumizeApiKey, id);
  if (!folder) {
    return c.json({ meta: {}, error: "Failed to fetch folder" }, 500);
  }

  let folderStreams: Stream[] = [];
  c.var.logger.debug(c.var.config);
  if (c.var.config.navigationViaStreamLinks) {
    c.var.logger.info("Stream links for navigation ENABLED");
    folderStreams = [
      {
        title: "^ Up a directory",
        externalUrl: `stremio:///detail/series/premiumize:${folder.parent_id}`,
      },
      ...folder.content
        .filter((item) => item.type === "folder")
        .map((item) => {
          return {
            externalUrl: `stremio:///detail/series/premiumize:${item.id}`,
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
          lang: "en/us",
        });
      }

      // type guard
      if (!item.link && !item.stream_link) {
        return;
      }

      const isWebReady = testIsWebReady(item);

      return {
        id: `premiumize:${item.id}`,
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
