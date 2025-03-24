import { fetchFolder } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import type { Stream, Subtitle } from "stremio-addon-sdk";

export const streamRouter = createRouter();

streamRouter.get("/:type/:id", async (c) => {
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
    return c.json({ meta: {}, error: "Failed to fetch folder" }, 500);
  }

  const streams: Stream[] = folder.content
    .filter((item) => {
      return item.link || item.stream_link;
    })
    .map((item) => {
      // see if there's a subtitle file in the same folder with the same name
      const fileName = item.name.split(".").slice(0, -1).join(".");
      const subtitle = folder.content.find((file) => {
        const name = file.name.split(".").slice(0, -1).join(".");
        if (name === fileName) {
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

      const isWebReady = item.stream_link && item.stream_link.endsWith(".mp4");

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

  return c.json({ streams });
});
