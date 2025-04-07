import { z } from "zod";
import type { Result } from "./result.type.js";

class PremiumizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PremiumizeError";
  }
}

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["file", "folder"]),
  size: z.number().optional(),
  created_at: z.number().optional(),
  mime_type: z.string().optional(),
  transcode_status: z
    .enum([
      "not_applicable",
      "running",
      "finished",
      "pending",
      "good_as_is",
      "error",
      "fetch_pending",
    ])
    .optional(),
  link: z.string().optional(),
  stream_link: z.string().nullable().optional(),
  virus_scan: z.enum(["ok", "infected", "error"]).optional(),
});

const BreadcrumbSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().optional(),
});

export const PremiumizeFolderResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  content: z.array(ItemSchema),
  breadcrumbs: z.array(BreadcrumbSchema).optional(),
  name: z.string().optional(),
  parent_id: z.string().optional(),
  folder_id: z.string().optional(),
});

const API_BASE = "https://www.premiumize.me/api";
export const premiumizeApi = async <T>(
  path: string,
  apiKey: string,
  schema: z.ZodType<T>
): Promise<Result<T>> => {
  try {
    const appendApiKey = (path.includes("?") ? "&" : "?") + `apikey=${apiKey}`;
    const url = `${API_BASE}${path}${appendApiKey}`;

    console.info(`[server] ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }

    const data = await res.json();

    // verify it matches the provided schema
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new PremiumizeError(`Failed to parse ${path}: ${result.error}`);
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    if (error instanceof PremiumizeError) {
      return {
        success: false,
        error: `[${error.name}] Failed to fetch data ${error.message}`,
      };
    }

    return { success: false, error: `Failed to fetch data: unknown reason` };
  }
};

export const fetchFolder = async (apikey: string, id?: string) => {
  try {
    const res = await premiumizeApi<
      z.infer<typeof PremiumizeFolderResponseSchema>
    >(
      `/folder/list?${id ? `id=${id}&` : ""}includebreadcrumbs=true`,
      apikey,
      PremiumizeFolderResponseSchema
    );

    return res;
  } catch (error) {
    console.error(error);
  }

  return undefined;
};

const ItemDetailSchema = z.object({
  id: z.string(),
  user_id: z.number(),
  customer_id: z.number(),
  name: z.string(),
  type: z.enum(["file", "folder"]),
  size: z.number(),
  created_at: z.number(),
  folder_id: z.string(),
  server_name: z.string(),
  acodec: z.string(),
  vcodec: z.string(),
  link: z.string().optional(),
  mime_type: z.string(),
  opensubtitles_hash: z.string(),
  resx: z.string(),
  resy: z.string(),
  duration: z.string(),
  transcode_status: z.enum([
    "not_applicable",
    "running",
    "finished",
    "pending",
    "good_as_is",
    "error",
    "fetch_pending",
  ]),
  virus_scan: z.enum(["ok", "infected", "error"]),
  stream_link: z.string().optional(),
  audio_track_names: z.array(z.string()),
  bitrate: z.number().optional(),
});

export const itemDetails = async (apikey: string, id: string) => {
  try {
    const res = await premiumizeApi<z.infer<typeof ItemDetailSchema>>(
      `/item/details?id=${id}`,
      apikey,
      ItemDetailSchema
    );

    return res;
  } catch (error) {
    console.error(error);
  }

  return undefined;
};

const SearchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["file", "folder"]),
  size: z.number().optional(),
  created_at: z.number().optional(),
  mime_type: z.string().optional(),
  link: z.string().optional(),
  directlink: z.string().optional(),
  stream_link: z.string().optional(),
});
const SearchFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["file", "folder"]),
  created_at: z.number(),
});
const SearchSchema = z.object({
  content: z.union([z.array(SearchItemSchema), z.array(SearchFolderSchema)]),
  name: z.string(),
});
export const search = async (apikey: string, query: string) => {
  try {
    const res = await premiumizeApi<z.infer<typeof SearchSchema>>(
      `/folder/search?q=${query}`,
      apikey,
      SearchSchema
    );

    return res;
  } catch (error) {
    console.error(error);
  }

  return undefined;
};
