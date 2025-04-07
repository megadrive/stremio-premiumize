import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ConfigFormInputSchema,
  type ConfigFormInput,
  config,
} from "@stremio-addon/config";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

async function generateInstallLinks(userConfig: ConfigFormInput): Promise<
  | {
      /** encoded config */
      config: string;
      /** manifest url, used for desktop. */
      url: string;
      /** install link for web */
      web: string;
    }
  | undefined
> {
  try {
    const encodedConfig = await config.encode({
      ...userConfig,
      baseUrl: window.location.origin,
    });
    if (!encodedConfig.success) {
      throw new Error("Invalid config");
    }
    // attempt to decode, if we can't then no bueno
    const decodeAttempt = await config.decode(encodedConfig.data);
    if (!decodeAttempt.success) {
      throw new Error("Invalid config");
    }

    const path = `/${encodedConfig.data}/manifest.json`;

    // if running locally in dev, use http, otherwise use Stremio protocol
    const protocol = window.location.origin.startsWith("http://localhost:4321")
      ? "http"
      : "stremio";
    const url = `${protocol}://${window.location.host}${path}`;
    const web = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(url)}`;

    return {
      config: encodedConfig.data,
      url,
      web,
    };
  } catch (error) {
    console.error(error);
  }

  return undefined;
}

export default function ConfigureForm() {
  const form = useForm<ConfigFormInput>({
    resolver: zodResolver(ConfigFormInputSchema),
    defaultValues: {
      premiumizeApiKey: "",
      navigationViaStreamLinks: false,
      hideFolderTags: true,
    },
  });

  const [configString, setConfigString] =
    useState<Awaited<ReturnType<typeof generateInstallLinks>>>();

  // handle form submission
  const onSubmit = form.handleSubmit(async (data) => {
    const generated = await generateInstallLinks(data);
    setConfigString(generated);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="premiumizeApiKey"
              render={({ field, fieldState }) => (
                <FormItem>
                  <div className="flex flex-col gap-1">
                    <FormLabel htmlFor="premiumizeApiKey">
                      Premiumize API Key
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        className="border-2 border-gray-300 rounded-md p-2"
                      />
                    </FormControl>
                    <span className="text-red-500">
                      {fieldState.error?.message}
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <p>
              You can get your Premiumize API key from{" "}
              <a
                href="https://www.premiumize.me/account"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                your account
              </a>
              .
            </p>

            <p>
              You can treat a folder like a TV series by adding "#tv" to the end
              of the folder name.
            </p>

            <FormField
              control={form.control}
              name="hideFolderTags"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-row gap-1">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel htmlFor="hideFolderTags">
                      Hide folder tags. ie: Get Smart #tv
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="navigationViaStreamLinks"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-row gap-1">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel htmlFor="navigationViaStreamLinks">
                      EXPERIMENTAL: Enable navigation via streams. Only use with
                      apps.
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <div className="text-center">
            <Button type="submit" className="w-full sm:w-1/3">
              Submit
            </Button>
          </div>
        </div>
        <div
          className={`${configString && !form.formState.isDirty ? "" : "hidden"} flex flex-row md:gap-6 gap-1 pt-1 justify-around`}
        >
          <Button
            className="grow"
            onClick={() =>
              configString ? window.open(configString.url) : undefined
            }
          >
            Install
          </Button>
          <Button
            variant="secondary"
            className="grow"
            onClick={() =>
              configString ? window.open(configString?.web) : undefined
            }
          >
            Install (web)
          </Button>
          <Button
            variant="outline"
            className="grow"
            onClick={(e) => {
              e.preventDefault();
              if (configString) {
                navigator.clipboard.writeText(configString.url);
              }
            }}
          >
            Copy
          </Button>
        </div>
      </form>
    </Form>
  );
}
