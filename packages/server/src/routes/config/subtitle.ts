import { prefix } from "@/consts.js";
import { fetchFolder } from "@/lib/premiumize.js";
import { createRouter } from "@/util/createHono.js";
import type { Subtitle } from "stremio-addon-sdk";
import { iso6392 } from "iso-639-2";

export const subtitleRouter = createRouter();

const langMap = new Set<string>(iso6392.map((lang) => lang.iso6392B));

// needs to match the following: " eng ", ".eng.", "-eng-", "_eng_"
const re_lang = new RegExp(
  `(?:^|[\\s._-])(${Array.from(langMap).join("|")})(?:$|[\\s._-])`,
  "i"
);

subtitleRouter.get("/:type/:id.json", async (c) => {
  const config = c.var.config;

  const id = c.req.param("id.json");
  const folderId = id.split(":")[1]?.replace(/\.json$/, "");

  if (!folderId) {
    return c.json({ error: "Invalid file ID" }, 400);
  }

  // grab the item to get its parent folder, then get all subtitle files based on the filename of the video item
  // fetch the folder contents
  const folderResult = await fetchFolder(config.premiumizeApiKey, folderId);
  if (!folderResult.success) {
    return c.json({ error: `Folder not found: ${folderId}` }, 404);
  }
  const folder = folderResult.data;

  // find all subtitles in the folder
  const exts = ["srt", "vtt"];
  const subtitles: Subtitle[] = folder.content
    .filter((file) => file.type === "file")
    .filter((file) => {
      const ext = file.name.split(".").pop();
      return ext && exts.includes(ext);
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
        id: `${prefix}:${folderId}:subtitle`,
        lang: file.langCode,
        url: file.link,
      };
    })
    .filter((file) => !!file);

  return c.json({ subtitles });
});
