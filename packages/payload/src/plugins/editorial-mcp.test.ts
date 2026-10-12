import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import type { AuthorizedMCP, SanitizedMCPPluginConfig } from '@payloadcms/plugin-mcp';
import { getAuthorizedMCP } from '@payloadcms/plugin-mcp/internal';
import { buildConfig } from 'payload';
import type { CollectionConfig, PayloadRequest, Plugin } from 'payload';
import { editorialMcpPlugin } from './editorial-mcp.ts';

const editorialSlugs = ['media', 'pages', 'places', 'walks', 'stories', 'events', 'music-artists'];
const privateSlugs = ['users', 'members', 'saved-places', 'walk-sessions', 'accounts', 'sessions', 'verifications', 'future-private'];
const curator = { id: 1, collection: 'users' };
const member = { id: 2, collection: 'members' };
const toolKeys = ['count', 'countVersions', 'create', 'delete', 'duplicate', 'find', 'findDistinct', 'findVersionByID', 'findVersions', 'getCollectionSchema', 'getUploadInstructions', 'restoreVersion', 'update'];

// Run the installed plugin's sanitizer and Payload config pipeline, without
// initializing Payload, connecting to a database, or starting a server.
async function configured(plugin = editorialMcpPlugin({ enabled: true })) {
  const collections: CollectionConfig[] = [...editorialSlugs, ...privateSlugs].map((slug) => ({
    slug,
    fields: [],
    ...(slug === 'users' || slug === 'members' ? { auth: true } : {}),
    ...(slug === 'media' ? { upload: true } : {}),
    ...(slug === 'pages' ? { versions: true } : {}),
  }));
  const config = await buildConfig({
    secret: 'offline-mcp-policy-test-only',
    admin: { user: 'users' },
    collections,
    globals: [{ slug: 'private-settings', fields: [] }],
    plugins: [plugin],
    db: postgresAdapter({ pool: {}, push: false }),
  });
  const registered = config.plugins!.find((candidate) => candidate.slug === '@payloadcms/plugin-mcp') as Plugin & { sanitizedOptions: SanitizedMCPPluginConfig };
  return { config, pluginConfig: registered.sanitizedOptions };
}

function request(config: Awaited<ReturnType<typeof configured>>['config'], user: unknown = curator) {
  const authCalls: { headers: Headers; req: PayloadRequest; previousUser: PayloadRequest['user'] }[] = [];
  const reads: Record<string, unknown>[] = [];
  const logger = { info() {}, warn() {}, error() {}, child() { return this; } };
  const req = {
    user: null,
    headers: new Headers({ Authorization: 'Bearer offline-test-placeholder' }),
    context: {}, query: {}, t: (key: string) => key,
    payload: {
      config,
      collections: Object.fromEntries(config.collections.map((collection) => [collection.slug, { config: collection }])),
      logger,
      auth: async (args: { headers: Headers; req: PayloadRequest }) => {
        authCalls.push({ ...args, previousUser: args.req.user });
        return { user };
      },
      find: async (args: Record<string, unknown>) => {
        reads.push(args);
        return { docs: [{ id: 5, title: 'Editorial fixture' }], totalDocs: 1, page: 1, totalPages: 1 };
      },
    },
  } as unknown as PayloadRequest;
  return { req, authCalls, reads };
}

// Inspect the actual SDK registration callbacks directly. No transports, MCP
// requests, database calls, or network services are used by these regressions.
type RegisteredTool = { handler: (input: Record<string, unknown>, context: object) => Promise<{ isError?: boolean; content: { text?: string }[] }> };
const { buildMcpServer } = await import(new URL('./mcp/buildMcpServer.js', import.meta.resolve('@payloadcms/plugin-mcp')).href) as {
  buildMcpServer: (args: { authorizedMCP: AuthorizedMCP; pluginConfig: SanitizedMCPPluginConfig; req: PayloadRequest }) => { _registeredTools: Record<string, RegisteredTool>; close: () => Promise<void> };
};

it('covers the pinned sanitizer behavior: omitted collections and globals get tools, and getConfigInfo overrides are ignored', async () => {
  const { config, pluginConfig } = await configured(mcpPlugin({
    collections: { pages: { tools: { find: { access: () => false } } } },
    tools: { getConfigInfo: { access: () => false, description: 'Disabled', handler: () => ({ content: [] }) } },
  }));
  assert.ok(pluginConfig.items.some((item) => item.type === 'collectionTool' && item.collectionSlug === 'members'));
  assert.ok(pluginConfig.items.some((item) => item.type === 'globalTool'));
  const configInfo = pluginConfig.items.find((item) => item.type === 'tool' && item.configKey === 'getConfigInfo');
  assert.ok(configInfo?.type === 'tool');
  const { req } = request(config, member);
  req.user = member as PayloadRequest['user'];
  assert.equal(await configInfo.tool.access!({ req }), true);
});

it('leaves both MCP endpoint methods absent by default and requires the explicit environment opt-in', async () => {
  for (const plugin of [editorialMcpPlugin(), editorialMcpPlugin({ enabled: false })]) {
    const { config, pluginConfig } = await configured(plugin);
    assert.equal(pluginConfig.disabled, true);
    assert.equal(config.endpoints.some((endpoint) => endpoint.path === '/mcp'), false);
    const { req, authCalls } = request(config);
    req.user = curator as PayloadRequest['user'];
    await assert.rejects(getAuthorizedMCP({ req, overrideAccess: true }), { name: 'UnauthorizedError' });
    assert.equal(req.user, null);
    assert.equal(authCalls.length, 0);
  }
  const { config } = await configured();
  assert.deepEqual(config.endpoints.filter((endpoint) => endpoint.path === '/mcp').map((endpoint) => endpoint.method).sort(), ['get', 'post']);
  assert.match(readFileSync(new URL('../payload.config.ts', import.meta.url), 'utf8'), /editorialMcpPlugin\(\{ enabled: process\.env\.PAYLOAD_MCP_ENABLED === 'true' \}\)/);
});

it('authenticates curators and authorizes only the existing editorial collection tools', async () => {
  const { config } = await configured();
  const { req, authCalls } = request(config);
  const result = await getAuthorizedMCP({ req, overrideAccess: false });
  assert.equal(req.user, curator);
  assert.equal(authCalls.length, 1);
  assert.equal(authCalls[0]!.req, req);
  assert.equal(authCalls[0]!.headers.get('DisableAutologin'), 'true');
  assert.equal(authCalls[0]!.headers.get('Authorization'), 'Bearer offline-test-placeholder');
  assert.equal(req.headers.has('DisableAutologin'), false);
  assert.equal(result.overrideAccess, false);
  assert.ok(result.items.every((item) => item.type === 'collectionTool' && editorialSlugs.includes(item.collectionSlug) && toolKeys.includes(item.configKey)));
  assert.deepEqual([...new Set(result.items.flatMap((item) => item.type === 'collectionTool' ? [item.collectionSlug] : []))].sort(), [...editorialSlugs].sort());
  const pageTools = result.items.filter((item) => item.type === 'collectionTool' && item.collectionSlug === 'pages').map((item) => item.configKey);
  assert.deepEqual(pageTools.sort(), toolKeys.filter((key) => key !== 'getUploadInstructions').sort());
  assert.deepEqual(result.items.filter((item) => item.configKey === 'getUploadInstructions').map((item) => item.type === 'collectionTool' && item.collectionSlug), ['media']);
});

it('rejects members, anonymous users, and unrecognized identities even with a stale curator on the request', async () => {
  const { config } = await configured();
  for (const identity of [member, null, { id: 3, collection: 'future-auth' }, { id: 4 }]) {
    for (const overrideAccess of [false, true]) {
      const { req, authCalls } = request(config, identity);
      req.user = curator as PayloadRequest['user'];
      await assert.rejects(getAuthorizedMCP({ req, overrideAccess }), { name: 'UnauthorizedError', status: 401 });
      assert.equal(authCalls.length, 1);
      assert.equal(authCalls[0]!.previousUser, null);
      assert.equal(req.user, identity);
    }
  }
});

it('never trusts a prepopulated user when headers are missing or authentication fails', async () => {
  const { config } = await configured();
  const missingHeaders = request(config);
  missingHeaders.req.user = curator as PayloadRequest['user'];
  Reflect.deleteProperty(missingHeaders.req, 'headers');
  await assert.rejects(getAuthorizedMCP({ req: missingHeaders.req, overrideAccess: true }), { name: 'UnauthorizedError' });
  assert.equal(missingHeaders.req.user, null);
  assert.equal(missingHeaders.authCalls.length, 0);
  const failedAuth = request(config);
  failedAuth.req.user = curator as PayloadRequest['user'];
  failedAuth.req.payload.auth = async () => {
    // Authentication can set req.user before a later permission check fails.
    failedAuth.req.user = curator as PayloadRequest['user'];
    throw new Error('Authentication failed');
  };
  await assert.rejects(getAuthorizedMCP({ req: failedAuth.req, overrideAccess: false }), /Authentication failed/);
  assert.equal(failedAuth.req.user, null);
});

it('preserves cookie authentication while disabling development autologin', async () => {
  const { config } = await configured();
  const { req, authCalls } = request(config);
  req.headers.delete('Authorization');
  req.headers.set('Cookie', 'payload-token=offline-test-placeholder');
  req.headers.set('DisableAutologin', 'false');
  await getAuthorizedMCP({ req, overrideAccess: false });
  assert.equal(authCalls[0]!.headers.get('Cookie'), req.headers.get('Cookie'));
  assert.equal(authCalls[0]!.headers.get('DisableAutologin'), 'true');
  assert.equal(req.user, curator);
});

it('excludes future/custom tools, prompts, resources, and globals before evaluating their access', async () => {
  const { config, pluginConfig } = await configured();
  let evaluated = false;
  const access = () => { evaluated = true; return true; };
  const tool = { description: 'Private', access, handler: () => ({ content: [] }) };
  pluginConfig.items.push(
    { type: 'collectionTool', collectionSlug: 'pages', configKey: 'futureTool', mcpName: 'futureTool', label: 'Future', tool },
    { type: 'collectionTool', collectionSlug: 'pages', configKey: 'toString', mcpName: 'toString', label: 'Inherited key', tool },
    { type: 'collectionTool', collectionSlug: 'pages', configKey: 'login', mcpName: 'login', label: 'Auth', tool },
    { type: 'collectionTool', collectionSlug: 'pages', configKey: 'getUploadInstructions', mcpName: 'getUploadInstructions', label: 'Upload', tool },
    { type: 'tool', configKey: 'privateTool', mcpName: 'privateTool', label: 'Private', tool },
    { type: 'prompt', configKey: 'privatePrompt', mcpName: 'privatePrompt', label: 'Private', prompt: { title: 'Private', description: 'Private', access, argsSchema: { type: 'object' }, handler: () => ({ messages: [] }) } },
    { type: 'resource', configKey: 'privateResource', mcpName: 'privateResource', label: 'Private', resource: { title: 'Private', description: 'Private', access, mimeType: 'text/plain', uri: 'test://private', handler: () => ({ contents: [] }) } },
  );
  const { req } = request(config);
  const result = await getAuthorizedMCP({ req, overrideAccess: true });
  assert.equal(evaluated, false);
  assert.equal(result.overrideAccess, false);
  assert.ok(result.items.every((item) => item.type === 'collectionTool' && editorialSlugs.includes(item.collectionSlug) && toolKeys.includes(item.configKey)));
});

it('does not bypass per-tool access when overrideAccess is requested', async () => {
  const { config, pluginConfig } = await configured();
  const find = pluginConfig.items.find((item) => item.type === 'collectionTool' && item.collectionSlug === 'pages' && item.configKey === 'find');
  assert.ok(find?.type === 'collectionTool');
  let checked = false;
  find.tool.access = ({ req }) => { checked = true; assert.equal(req.user, curator); return false; };
  const { req } = request(config);
  const result = await getAuthorizedMCP({ req, overrideAccess: true });
  assert.equal(checked, true);
  assert.equal(result.items.includes(find), false);
  assert.equal(result.overrideAccess, false);
});

it('blocks direct calls against hidden collections and never registers private or cross-cutting tools', async () => {
  const { config, pluginConfig } = await configured();
  const { req, reads } = request(config);
  const authorizedMCP = await getAuthorizedMCP({ req, overrideAccess: true });
  const server = buildMcpServer({ authorizedMCP, pluginConfig, req });
  try {
    assert.equal(server._registeredTools.getConfigInfo, undefined);
    assert.equal(server._registeredTools.findGlobal, undefined);
    assert.equal(server._registeredTools.login, undefined);
    for (const slug of privateSlugs) {
      for (const tool of ['findDocuments', 'createDocuments', 'deleteDocuments', 'getCollectionSchema']) {
        const response = await server._registeredTools[tool]!.handler({ slug }, {});
        assert.equal(response.isError, true, `${tool} rejects ${slug}`);
        assert.match(response.content[0]!.text!, /MCP access .* is not enabled/);
      }
    }
    assert.equal(reads.length, 0);
  } finally { await server.close(); }
});

it('retains editorial handler behavior and always forwards normal Payload access checks', async () => {
  const { config, pluginConfig } = await configured();
  const { req, reads } = request(config);
  const authorizedMCP = await getAuthorizedMCP({ req, overrideAccess: true });
  const server = buildMcpServer({ authorizedMCP, pluginConfig, req });
  try {
    const where = { title: { equals: 'Editorial fixture' } };
    const response = await server._registeredTools.findDocuments!.handler({ slug: 'pages', where, limit: 2, draft: true }, {});
    assert.match(response.content[0]!.text!, /Editorial fixture/);
    assert.equal(response.isError, undefined);
    assert.equal(reads.length, 1);
    assert.equal(reads[0]!.collection, 'pages');
    assert.equal(reads[0]!.req, req);
    assert.equal(reads[0]!.overrideAccess, false);
    assert.equal(reads[0]!.where, where);
    assert.equal(reads[0]!.limit, 2);
    assert.equal(reads[0]!.draft, true);
    assert.equal('doc' in response, false);
  } finally { await server.close(); }
});
