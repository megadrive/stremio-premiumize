import { z } from "zod";

/**
 * ? The config schema. Any user-configurable data should be defined here.
 * ? It gets encoded into a string and provided to the addon as a query parameter.
 *
 * If you wanted to add stuff like a debrid apikey, for instance. You would add it here.
 *
 * @configuration
 */
export const ConfigSchema = z.object({
  /** Provide via the /configure form, used for absolute URLs. */
  baseUrl: z.string(),
  premiumizeApiKey: z
    .string()
    .min(1, "You must provide an API key for the addon to work"),
  navigationViaStreamLinks: z.boolean().default(false),
});
export type Config = z.infer<typeof ConfigSchema>;

export const ConfigFormInputSchema = ConfigSchema.omit({
  baseUrl: true,
});
export type ConfigFormInput = z.infer<typeof ConfigFormInputSchema>;

type Result<T> = { success: true; data: T } | { success: false; error: string };

export const config = {
  /**
   * Decodes the config from a string.
   * @param data Datastring from a URL
   * @returns Config object or undefined if decoding failed
   */
  decode: async (data: string): Promise<Result<Config>> => {
    try {
      const decoded = JSON.parse(atob(data));
      const parsed = ConfigSchema.parse(decoded);

      return {
        success: true,
        data: parsed,
      };
    } catch (e: unknown) {
      // @ts-expect-error Message exists on a parsing error.
      return { success: false, error: e.message };
    }
  },
  /**
   * Encodes the config into a string.
   * @param data Config object to encode
   * @returns Encoded string
   */
  encode: async (data: Config): Promise<Result<string>> => {
    try {
      const encoded = btoa(JSON.stringify(data));

      return {
        success: true,
        data: encoded,
      };
    } catch (e: unknown) {
      // @ts-expect-error Message exists on a parsing error.
      return { success: false, error: e.message };
    }
  },
};
