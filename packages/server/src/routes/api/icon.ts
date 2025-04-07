import { createAPIRouter } from "@/util/createHono.js";

export const iconAPIRouter = createAPIRouter();

// TODO this is serving as "plain/text" for some reason. should be image/svg+xml
iconAPIRouter.get("/:icon/:type?", (c) => {
  const icon = c.req.param("icon");
  const type = c.req.param("type") ?? "poster";

  const dimensions = {
    square: [100, 100],
    poster: [100, 150],
  };

  const [w, h] =
    dimensions[type as keyof typeof dimensions] ?? dimensions.poster;

  c.header("Content-Type", "image/svg+xml");
  return c.body(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><text y=".9em" x="-0.1em" font-size="90">${icon}</text></svg>`
  );
});
