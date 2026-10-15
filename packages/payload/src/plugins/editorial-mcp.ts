import { mcpPlugin } from '@payloadcms/plugin-mcp';
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp';
import { filterMCPItems } from '@payloadcms/plugin-mcp/internal';
import { UnauthorizedError } from 'payload';
import type { PayloadRequest } from 'payload';

const editorialCollections = new Set([
  'media', 'pages', 'places', 'walks', 'stories', 'events', 'music-artists',
]);
const curatorMcpAccess = ({ req }: { req: PayloadRequest }): boolean =>
  req.user?.collection === 'users';

const curatorMcpTools = {
  count: { access: curatorMcpAccess },
  countVersions: { access: curatorMcpAccess },
  create: { access: curatorMcpAccess },
  delete: { access: curatorMcpAccess },
  duplicate: { access: curatorMcpAccess },
  find: { access: curatorMcpAccess },
  findDistinct: { access: curatorMcpAccess },
  findVersionByID: { access: curatorMcpAccess },
  findVersions: { access: curatorMcpAccess },
  getCollectionSchema: { access: curatorMcpAccess },
  restoreVersion: { access: curatorMcpAccess },
  update: { access: curatorMcpAccess },
};

/**
 * The pinned MCP plugin's collection map is an override map, not an allowlist.
 * Its sanitizer also always includes getConfigInfo, ignoring tool overrides.
 * Limit the authorized items before either discovery or handler registration.
 */
const authorizeEditorialMcp: NonNullable<MCPPluginConfig['overrideGetAuthorizedMCP']> = async ({ pluginConfig, req }) => {
  // Replacing the plugin authorizer also replaces its authentication. Never
  // trust a prepopulated user, even for a local/development overrideAccess call.
  req.user = null;
  if (pluginConfig.disabled || !req.headers) throw new UnauthorizedError(req.t);
  const headers = new Headers(req.headers);
  headers.set('DisableAutologin', 'true');
  try {
    req.user = (await req.payload.auth({ headers, req })).user ?? null;
  } catch (error) {
    req.user = null;
    throw error;
  }
  if (!curatorMcpAccess({ req })) throw new UnauthorizedError(req.t);

  const items = pluginConfig.items.filter((item) =>
    item.type === 'collectionTool'
    && editorialCollections.has(item.collectionSlug)
    && (Object.hasOwn(curatorMcpTools, item.configKey)
      || (item.collectionSlug === 'media' && item.configKey === 'getUploadInstructions')),
  );
  // Keep item checks and the built-in handlers' Payload access checks enabled.
  // An overrideAccess query parameter must never widen this editorial surface.
  return {
    items: await filterMCPItems({ items, overrideAccess: false, req }),
    overrideAccess: false,
  };
};

export function editorialMcpPlugin({ enabled = false }: { enabled?: boolean } = {}) {
  return mcpPlugin({
    collections: {
      media: {
        tools: {
          ...curatorMcpTools,
          getUploadInstructions: { access: curatorMcpAccess },
        },
      },
      pages: { tools: curatorMcpTools },
      places: { tools: curatorMcpTools },
      walks: { tools: curatorMcpTools },
      stories: { tools: curatorMcpTools },
      events: { tools: curatorMcpTools },
      'music-artists': { tools: curatorMcpTools },
    },
    disabled: !enabled,
    overrideGetAuthorizedMCP: authorizeEditorialMcp,
  });
}
