import { fetchFolder } from "./premiumize.js";
import type { Result } from "./result.type.js";

class FolderSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolderSettingsError";
  }
}

type FolderSettings = Partial<{ tv: boolean; hide: boolean }>;
const DefaultFolderSettings: FolderSettings = {
  tv: false,
} as const;

const SETTINGS_FOLDER_NAME = ".settings";

const parseTags = (name: string): Result<FolderSettings> => {
  const keys = Object.keys(DefaultFolderSettings);

  let changed = false;
  const settings = keys.reduce(
    (acc, key) => {
      if (name.includes(`#${key}`)) {
        acc[key as keyof typeof DefaultFolderSettings] = true;
        changed = true;
      }

      return acc;
    },
    {
      ...DefaultFolderSettings,
    }
  );

  if (!changed) {
    return {
      success: false,
      error: "No settings found",
    };
  }

  return { success: true, data: settings };
};

/**
 *
 * @param apikey Premimize API key
 * @param folderId Folder ID to fetch potential settings for
 * @returns
 */
export const fetchFolderSettings = async (
  apikey: string,
  folderId?: string
): Promise<Result<FolderSettings>> => {
  try {
    const folderResult = await fetchFolder(apikey, folderId);

    if (!folderResult?.success) {
      throw new FolderSettingsError("Failed to fetch folder");
    }

    const { data: folder } = folderResult;

    // Prefer hashtags over .settings folder for now. Blockscope it for fun
    {
      const settings = parseTags(folder.name ?? "");
      if (settings.success) {
        console.info(
          `Found hash settings in folder name: ${folder.name} returning.`
        );
        return { success: true, data: settings.data };
      }

      // move up the breadcrumbs to see if there are any settings there
      for (const breadcrumb of folder.breadcrumbs ?? []) {
        if (breadcrumb.name) {
          const settings = parseTags(breadcrumb.name);
          if (settings.success) {
            console.info(
              `Found hash settings in breadcrumb name: ${breadcrumb.name} returning.`
            );
            return { success: true, data: settings.data };
          }
        }
      }
    }

    // is there a .settings folder in the folder?
    const settingsFolder = folder.content.find(
      (item) => item.name === SETTINGS_FOLDER_NAME && item.type === "folder"
    );
    let settingsFolderId = settingsFolder?.id;

    console.info("Found .settings folder?", !!settingsFolderId);

    if (!settingsFolder && folder.breadcrumbs) {
      console.info("No .settings folder, looking in parent folder");

      // could be above the current folder, go look through the breadcrumbs
      for (const breadcrumb of folder.breadcrumbs) {
        const breadcrumbFolderResult = await fetchFolder(apikey, breadcrumb.id);

        if (!breadcrumbFolderResult?.success) {
          console.error("Failed to fetch breadcrumb folder");
          continue;
        }

        const breadcrumbFolder = breadcrumbFolderResult.data;

        const settingsFolder = breadcrumbFolder.content.find(
          (item) => item.name === SETTINGS_FOLDER_NAME && item.type === "folder"
        );

        if (settingsFolder) {
          settingsFolderId = settingsFolder.id;
          break;
        }
      }

      if (!settingsFolderId) {
        console.info(
          "No .settings folder in parent folders, returning default settings"
        );

        return {
          success: true,
          data: { tv: false, hide: false },
        };
      }
    }

    const settingsFolderContentResult = await fetchFolder(
      apikey,
      settingsFolderId
    );

    if (!settingsFolderContentResult?.success) {
      throw new FolderSettingsError("Failed to fetch settings folder");
    }

    const settingsFolderContent = settingsFolderContentResult.data;

    // get the actual settings
    const hide = settingsFolderContent.content.find(
      (item) => item.name === ".hide"
    );
    const tv = settingsFolderContent.content.find(
      (item) => item.name === ".tv"
    );

    console.info("Settings: ", { tv, hide });

    return {
      success: true,
      data: {
        tv: !!tv,
        hide: !!hide,
      },
    };
  } catch (error) {
    if (error instanceof FolderSettingsError) {
      console.error(error.message, error);
      return {
        success: false,
        error: "Failed to fetch folder settings: " + error.message,
      };
    }

    console.error("Unknown error getting folder settings", error);
  }

  return {
    success: false,
    error: "Failed to fetch folder settings",
  };
};

fetchFolderSettings("bpestfy8pszn6zwj", "TLv5Gkv66U7CFyasWEXn6g")
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.error(error);
  });
