import { Router } from "express";
import { ContentType, MetaDetail } from "stremio-addon-sdk";
import type { Request, TypedJsonResponse } from "@/util/typedJsonResponse";
import { Config } from "@stremio-addon/config";
import { fetchFolder, itemDetails } from "@/lib/premiumize";

// should match: /:config/meta/:type/:id/:extras?.json
// ex: /configexample/meta/movie/123456.json
export const metaRouter: Router = Router({ mergeParams: true }).get(
  "/:type/:id.json",
  async (
    req: Request,
    res: TypedJsonResponse<{ meta: MetaDetail } | { error: string }>
  ) => {
    const { type, id } = req.params as { type: ContentType; id: string };

    const config = res.locals.config as Config | undefined;
    if (!config) {
      res.status(500).json({ error: "Config not found" });
      return;
    }

    const [, premiumizeType, fid] = id.split(":");

    let meta: MetaDetail = {
      id: `premiumize:error:${id}`,
      name: "An error occurred.",
      type: "movie",
      description: "An error occurred.",
    };

    if (type === "movie") {
      const details = await itemDetails(config.premiumizeApiKey, fid);

      if (!details) {
        res.status(500).json({ error: "Item not found" });
        return;
      }

      meta = {
        id,
        name: details.name,
        type: premiumizeType === "file" ? "movie" : "series",
        description: `${details.duration} ${details.resx}x${details.resy}`,
      };
    }

    if (type === "series") {
      // treat as a folder
      const folder = await fetchFolder(config.premiumizeApiKey, fid);
      const name = folder?.name ?? "Unnamed";

      meta = {
        id,
        name,
        type: "series",
        description: `Path: /${folder?.breadcrumbs?.map((b) => b.name).join(" / ")}/${name}`,
      };
    }

    res.json({ meta });
  }
);
