import { prefix } from "@/consts.js";
import { PremiumizeClient } from "@almosteffective/premiumize-api";
import { createRouter } from "@/util/createHono.js";
import type { Subtitle } from "stremio-addon-sdk";
import { iso6392 } from "iso-639-2";
import { z } from "zod";
import { fuzzy } from "fast-fuzzy";
import { to } from "await-to-js";

export const subtitleRouter = createRouter();

const langMap = new Set<string>(iso6392.map((lang) => lang.iso6392B));

// needs to match the following: " eng ", ".eng.", "-eng-", "_eng_"
const re_lang = new RegExp(
  `(?:^|[\\s._-])(${Array.from(langMap).join("|")})(?:$|[\\s._-])`,
  "i"
);

const stripExtension = (filename: string) => {
  return filename.split(".").slice(0, -1).join(".");
};

const stripNonAlphaNumeric = (str: string) => {
  return str.replace(/[^a-zA-Z0-9]/g, "");
};

const normaliseSeasonEpisodeNumbers = (str: string) => {
  const regex = /[SE](\d+)/i;
  const match = str.match(regex);
  if (match) {
    const prefix = match[0][0];
    const number = match[1].padStart(2, "0");
    return str.replace(regex, `${prefix}${number}`);
  }
  return str;
};

const removeShowTitleFromStart = (str: string, showTitle: string) => {
  const regex = new RegExp(`^${stripNonAlphaNumeric(showTitle)}`, "i");
  return str.replace(regex, "");
};

const normalise = (filename: string) => {
  // remove the extension
  const name = stripExtension(filename);
  // remove non-alphanumeric characters
  const stripped = stripNonAlphaNumeric(name);
  // remove the show title from the start
  const noShowTitle = removeShowTitleFromStart(stripped, "Blue Heelers");
  // normalise season/episode numbers
  const seasonEpisodeNumbers = normaliseSeasonEpisodeNumbers(noShowTitle);

  const normalised = seasonEpisodeNumbers;
  return normalised;
};

subtitleRouter.get("/:type/:id.json", async (c) => {
  const premiumizeApi = PremiumizeClient.create(c.var.config.premiumizeApiKey);

  const id = c.req.param("id.json");
  const fileId = id.split(":")[1]?.replace(/\.json$/, "");

  if (!fileId) {
    return c.json({ error: "Invalid file ID" }, 400);
  }

  const [itemDeetsErr, itemDeets] = await to(
    premiumizeApi.getItemDetails({ id: fileId })
  );
  if (itemDeetsErr || !itemDeets) {
    return c.json({ error: `Item not found: ${fileId}` }, 404);
  }
  const folderId = itemDeets.folder_id;

  // grab the item to get its parent folder, then get all subtitle files based on the filename of the video item
  // fetch the folder contents
  const [folderErr, folder] = await to(
    premiumizeApi.listFolder({ id: folderId })
  );
  if (folderErr || !folder) {
    return c.json({ error: `Folder not found: ${fileId}` }, 404);
  }

  // find all subtitles in the folder
  const exts = ["srt", "vtt"];
  const subtitles: Subtitle[] = folder.content
    .filter((file) => file.type === "file")
    .filter(function filterSubtitleExtensions(file) {
      const ext = file.name.split(".").pop();
      return ext && exts.includes(ext);
    })
    .filter(function matchWithFileBestGuess(file) {
      const videoFilename = itemDeets.name;
      const subtitleFilename = file.name;

      const videoNormalised = normalise(videoFilename);
      const subtitleNormalised = normalise(subtitleFilename);

      const score = fuzzy(videoNormalised, subtitleNormalised);
      return score > 0.9;
    })
    .map(function mapToSubtitle(file) {
      if (!file.link) {
        return undefined;
      }
      const langMatch = file.name.match(re_lang);
      const lang = langMatch ? langMatch[1] : "eng";
      const langCode = langMap.has(lang) ? lang : "eng";
      const subtitle: Subtitle = {
        id: `${prefix}:${file.id}:subtitle`,
        lang: langCode,
        url: file.link,
      };

      return subtitle;
    })
    .filter((file) => !!file);

  return c.json({ subtitles });
});
