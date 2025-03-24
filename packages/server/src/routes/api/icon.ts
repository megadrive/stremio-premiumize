import { createAPIRouter } from "@/util/createHono.js";

export const iconAPIRouter = createAPIRouter();

// TODO this is serving as "plain/text" for some reason. should be image/svg+xml
iconAPIRouter.get("/:icon", (c) => {
  const icon = c.req.param("icon");

  c.header("Content-Type", "image/svg+xml");
  return c.body(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" x="-0.1em" font-size="90">${icon}</text></svg>`
  );
});
