import { Router } from "express";
import { Stream } from "stremio-addon-sdk";
import type { Request, TypedJsonResponse } from "@/util/typedJsonResponse";
import { fetchFolder, itemDetails } from "@/lib/premiumize";
import { Config } from "@stremio-addon/config";

export const streamRouter: Router = Router();

streamRouter.get(
  "/:type/:id.json",
  async (req: Request, res: TypedJsonResponse<{ streams: Stream[] }>) => {
    const { type, id } = req.params;

    const config = res.locals.config as Config | undefined;
    if (!config) {
      res.status(500).json();
      return;
    }

    const [, ftype, fid] = id.split(":");

    console.info({ url: { type, id } }, { ftype, fid });

    const streams: Stream[] = [];

    if (type === "series") {
      console.info(`is series`);
      // list all files within the folder
      const folder = await fetchFolder(config.premiumizeApiKey, fid);
      console.info({ folder });
      if (!folder) {
        res.status(500).json();
        return;
      }

      for (const item of folder.content) {
        if (item.type !== "file") {
          continue;
        }
        streams.push({
          name: item.name,
          url: item.stream_link, //mp4
        });
      }
    }

    if (type === "movie") {
      // list the item details
      const details = await itemDetails(config.premiumizeApiKey, fid);
      if (!details) {
        res.status(500).json();
        return;
      }

      streams.push({
        name: details.name,
        url: details.stream_link, //mp4
      });
    }

    res.json({ streams });
  }
);
