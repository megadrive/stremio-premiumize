import { prefix } from "@/consts.js";
import { fetchFolder, itemDetails } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import type { Subtitle } from "stremio-addon-sdk";
import { iso6392 } from "iso-639-2";
import { z } from "zod";

export const subtitleRouter = createRouter();

const langMap = new Set<string>(iso6392.map((lang) => lang.iso6392B));

// needs to match the following: " eng ", ".eng.", "-eng-", "_eng_"
const re_lang = new RegExp(
  `(?:^|[\\s._-])(${Array.from(langMap).join("|")})(?:$|[\\s._-])`,
  "i"
);

const stripNonAlphaNumeric = (str: string) => {
  return str.replace(/[^a-zA-Z0-9-_ ]/g, "_");
};

subtitleRouter.get("/:type/:id.json", async (c) => {
  const config = c.var.config;

  const id = c.req.param("id.json");
  const fileId = id.split(":")[1]?.replace(/\.json$/, "");

  if (!fileId) {
    return c.json({ error: "Invalid file ID" }, 400);
  }

  const itemDeets = await itemDetails(config.premiumizeApiKey, fileId);
  if (!itemDeets.success) {
    return c.json({ error: `Item not found: ${fileId}` }, 404);
  }
  const folderId = itemDeets.data.folder_id;

  // grab the item to get its parent folder, then get all subtitle files based on the filename of the video item
  // fetch the folder contents
  const folderResult = await fetchFolder(config.premiumizeApiKey, folderId);
  if (!folderResult.success) {
    return c.json({ error: `Folder not found: ${fileId}` }, 404);
  }
  const folder = folderResult.data;

  // find all subtitles in the folder
  const exts = ["srt", "vtt"];
  const subtitles: Subtitle[] = folder.content
    .filter((file) => file.type === "file")
    .filter(function filterSubtitleExtensions(file) {
      const ext = file.name.split(".").pop();
      return ext && exts.includes(ext);
    })
    .filter(function matchWithFileBestGuess(file) {
      // check if the file name contains the video file name
      const videoFileName = stripNonAlphaNumeric(itemDeets.data.name);
      const fileName = stripNonAlphaNumeric(
        file.name.split(".").slice(0, -1).join(".")
      );
      const regex = new RegExp(fileName, "i");
      return regex.test(videoFileName);
    })
    .map((file) => {
      // ensure it matches a language, then provide that language in the response
      const match = file.name.match(re_lang);
      if (!match) {
        console.warn(
          `Subtitle file ${file.name} does not match a language code, using default (eng)`
        );
        return {
          ...file,
          langCode: "eng",
        };
      }
      return {
        ...file,
        langCode: match[1],
      };
    })
    .map((file) => {
      if (!file.link) {
        return undefined;
      }

      return {
        id: `${prefix}:${fileId}:subtitle`,
        lang: file.langCode,
        url: file.link,
      };
    })
    .filter((file) => !!file);

  return c.json({ subtitles });
});

export const utils = {
  /** Filters an array and returns items with an approved subtitle. */
  filterSubtitleItems: (items: unknown[]) => {
    const _items = z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
        })
      )
      .parse(items);

    const supportedExtensions = ["srt", "vtt"];
    return _items.filter((item) => {
      if (typeof item !== "object" || !item) {
        return false;
      }
      const fileName = item.name as string;
      const ext = fileName.split(".").pop();
      return typeof ext === "string" && supportedExtensions.includes(ext);
    });
  },
};
