# Stremio Premiumize Addon - AI Agent Guidelines

## Architecture Overview

This is a **Stremio addon** that integrates with Premiumize cloud storage to provide streaming access to user's media library. The addon follows Stremio's URL-encoded configuration pattern where user settings are base64-encoded in the URL path.

**Key Components:**
- **Monorepo Structure**: 4 packages under `@stremio-addon` namespace using pnpm workspaces
- **Server** (`packages/server`): Hono-based Express server handling Stremio API endpoints
- **Frontend** (`packages/frontend`): Astro-based configuration UI with React components
- **Config** (`packages/config`): Zod-validated configuration schema and encoding/decoding
- **Env** (`packages/env`): Environment variable validation using Envalid

## Critical Patterns

### Configuration Flow
```typescript
// Config is URL-encoded: /:config/manifest.json
// Decode in middleware: packages/server/src/middleware/parseConfigFromUrl.ts
const configString = c.req.param("config");
const decode = await config.decode(configString); // Zod validation
c.set("config", decode.data); // Available in all routes
```

### Manifest Creation
```typescript
// Dynamic manifest based on config: packages/server/src/util/manifest.ts
export const addonManifest = createManifest({
  id: `${serverEnv.isDevelopment ? "dev." : ""}megadrive.premiumize-library`,
  resources: ["meta", "catalog", { name: "stream", idPrefixes: [""] }],
  catalogs: [{ id: "library", type: `premiumize${devSuffix}` }]
});
```

### Premiumize Integration
```typescript
// API client: packages/server/src/lib/premiumize.ts
const response = await fetch(`${API_BASE}/folder/list`, {
  headers: { "Authorization": `Bearer ${config.premiumizeApiKey}` }
});
const data = PremiumizeFolderResponseSchema.parse(await response.json());
```

### Routing Structure
```typescript
// Config routes require parsed config: packages/server/src/util/createHono.ts
const configRouter = createRouter(); // Auto-parses :config param
configRouter.route("/manifest.json", manifestRouter);
configRouter.route("/catalog", catalogRouter);
// API routes don't need config
const apiRouter = createAPIRouter();
```

## Development Workflows

### Local Development
```bash
pnpm dev          # Parallel dev servers (Astro:4321, Server:3000)
pnpm build        # Build all packages
pnpm start        # Production server on port 3000
pnpm lint         # ESLint with Prettier
pnpm format       # Auto-format with Prettier
```

### Key Files to Reference
- **packages/server/src/index.ts**: Main server setup and routing
- **packages/config/src/config.ts**: Configuration schema and validation
- **packages/server/src/lib/premiumize.ts**: Premiumize API integration
- **packages/frontend/src/components/ConfigureForm.tsx**: User configuration UI
- **packages/server/src/util/manifest.ts**: Stremio manifest configuration

## Code Conventions

### Error Handling
```typescript
// Use Result type for operations: packages/server/src/lib/result.type.ts
type Result<T> = { success: true; data: T } | { success: false; error: string };

// Premiumize operations return Result<T>
async function fetchFolder(id: string): Promise<Result<PremiumizeItem[]>> {
  try {
    const response = await fetch(`${API_BASE}/folder/list`, { ... });
    return { success: true, data: parsed.content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Type Safety
- **Zod schemas** for all external data validation
- **Strict TypeScript** with no implicit any
- **Runtime type checking** for config and API responses

### Logging
```typescript
// Pino logger available in all routes via middleware
c.var.logger.info("Processing request", { userId, itemId });
c.var.logger.error(error, "Failed to fetch item details");
```

## Deployment

### Docker Build
```dockerfile
# Multi-stage build: deps → build → runtime
FROM node:24-bookworm-slim
RUN pnpm install --frozen-lockfile
RUN pnpm -r build
COPY --from=build /app /app
CMD ["pnpm", "start"]
```

### Environment Variables
- **NODE_ENV**: Controls production vs development behavior
- **PORT**: Server port (default 3000)
- **Premiumize API Key**: Provided via user configuration form

## Common Tasks

### Adding New Configuration Options
1. Add field to `ConfigSchema` in `packages/config/src/config.ts`
2. Update `ConfigureForm.tsx` with form input
3. Use in server routes via `c.var.config.newField`

### Adding New Stremio Resources
1. Add resource to manifest in `packages/server/src/util/manifest.ts`
2. Create route handler in `packages/server/src/routes/config/`
3. Register route in `packages/server/src/index.ts`

### Premiumize API Integration
1. Define Zod schema for API response
2. Add method to `packages/server/src/lib/premiumize.ts`
3. Handle authentication via `config.premiumizeApiKey`
4. Return `Result<T>` for error handling</content>
<parameter name="filePath">/home/andy/code/stremio-premiumize/.github/copilot-instructions.md
