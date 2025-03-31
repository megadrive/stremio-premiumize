import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ConfigFormInputSchema,
  type ConfigFormInput,
  config,
} from "@stremio-addon/config";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
  const {
    register,
    handleSubmit,
    formState,
    formState: { errors },
  } = useForm<ConfigFormInput>({
    resolver: zodResolver(ConfigFormInputSchema),
    defaultValues: {
      premiumizeApiKey: "",
    },
  });

  const [configString, setConfigString] =
    useState<Awaited<ReturnType<typeof generateInstallLinks>>>();

  // handle form submission
  const onSubmit = handleSubmit(async (data) => {
    const generated = await generateInstallLinks(data);
    setConfigString(generated);
  });

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="premiumizeApiKey">Premiumize API Key</Label>

            <Input
              type="password"
              {...register("premiumizeApiKey")}
              className="border-2 border-gray-300 rounded-md p-2"
            />
            <span className="text-red-500">
              {errors.premiumizeApiKey?.message}
            </span>
          </div>
        </div>
        <div className="text-center">
          <Button type="submit" className="w-full sm:w-1/3">
            Submit
          </Button>
        </div>
      </div>
      <div
        className={`${configString && !formState.isDirty ? "" : "hidden"} flex flex-row md:gap-6 gap-1 pt-1 justify-around`}
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
  );
}
