import { Router } from "express";
import { MetaDetail } from "stremio-addon-sdk";
import type { Request, TypedJsonResponse } from "@/util/typedJsonResponse";
import { parseExtras } from "@/util/parseExtras";
import { Config } from "@stremio-addon/config";
import { fetchFolder } from "@/lib/premiumize";

export const catalogRouter: Router = Router();

catalogRouter.get(
  "/:type/:id/:extras?.json",
  async (req: Request, res: TypedJsonResponse<{ metas: MetaDetail[] }>) => {
    const { type, id, extras } = req.params;

    const parsedExtras = parseExtras(extras);
    console.info(
      `[${type}] ${id} with extras: ${JSON.stringify(parsedExtras)}`
    );

    const config = res.locals.config as Config | undefined;

    if (!config) {
      res.status(500).json();
      return;
    }

    console.info({ config });

    const items = await fetchFolder(
      config.premiumizeApiKey,
      config.rootFolderId ?? id
    );

    // convert to MetaDetail[]
    const metas: MetaDetail[] =
      items?.content?.map((item) => {
        const meta: MetaDetail = {
          id: `premiumize:${item.type}:${item.id}`,
          name: item.name,
          type: item.type === "folder" ? "series" : "movie",
          description: item.name,
        };
        return meta;
      }) ?? [];

    res.json({ metas });
  }
);
