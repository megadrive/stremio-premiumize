import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConfigSchema, type Config, config } from "@stremio-addon/config";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function generateInstallLinks(userConfig: Config): Promise<
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
    const encodedConfig = await config.encode(userConfig);
    // attempt to decode, if we can't then no bueno
    const decoded = await config.decode(encodedConfig);
    if (!decoded) {
      throw new Error("Invalid config");
    }

    const path = `/${encodedConfig}/manifest.json`;

    // if running locally in dev, use http, otherwise use stremio protocol
    const protocol = window.location.origin.startsWith("http://localhost:4321")
      ? "http"
      : "stremio";
    const url = `${protocol}://${window.location.host}${path}`;
    const web = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(url)}`;

    return {
      config: encodedConfig,
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
  } = useForm<Config>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      premiumizeApiKey: "",
    },
    mode: "onChange",
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
          <Label htmlFor="variable1">
            Premiumize API Key
            <span className="text-red-500">
              {errors.premiumizeApiKey?.message}
            </span>
          </Label>

          <Input
            type="password"
            {...register("premiumizeApiKey")}
            className="border-2 border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="text-center">
          <Button type="submit" className="w-full sm:w-1/3">
            Submit
          </Button>
        </div>
      </div>
      <div
        className={`${configString && !formState.isDirty ? "" : "hidden"} flex flex-row gap-6 justify-around pt-1`}
      >
        <Button onClick={() => window.open(configString?.url ?? "")}>
          Install
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.open(configString?.web ?? "")}
        >
          Install (web)
        </Button>
        <Button
          variant="outline"
          className="p-2"
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(configString?.url ?? "");
          }}
        >
          Copy
        </Button>
      </div>
    </form>
  );
}
