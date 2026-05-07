const path = require('path');
const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getBlobContainerClient, getCosmosContainer, getUserId } = require('../lib/azureClients');
const { errorResponse, jsonResponse, noContentResponse, normalizeTags, readJson } = require('../lib/http');
const { firstValue, parseMultipartRequest } = require('../lib/parseMultipart');

const allowedVisibility = new Set(['public', 'private']);

function clientError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function cleanText(value, fallback = '') {
  const text = firstValue(value);
  return typeof text === 'string' ? text.trim() : fallback;
}

function requireAssetId(id) {
  const value = typeof id === 'string' ? id.trim() : '';
  if (!value) {
    throw clientError('Asset id is required.');
  }

  return value;
}

function requireTitle(value) {
  const title = cleanText(value);
  if (!title) {
    throw clientError('Title is required.');
  }

  return title;
}

function validateVisibility(value, fallback = 'public') {
  const visibility = cleanText(value, fallback).toLowerCase();
  if (!allowedVisibility.has(visibility)) {
    throw clientError('Visibility must be either public or private.');
  }

  return visibility;
}

function getImageExtension(file) {
  const originalName = file.originalFilename || '';
  const ext = path.extname(originalName).toLowerCase();
  if (ext) return ext;

  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };

  return mimeMap[file.mimetype] || '.jpg';
}

function validateImageFile(file) {
  if (!file) {
    throw clientError('Image file is required.');
  }

  if (!file.mimetype || !file.mimetype.toLowerCase().startsWith('image/')) {
    throw clientError('Uploaded file must be an image.');
  }
}

function resolveStatus(err) {
  if (Number.isInteger(err.statusCode)) {
    return err.statusCode;
  }

  if (Number.isInteger(err.status)) {
    return err.status;
  }

  if (Number.isInteger(err.httpCode)) {
    return err.httpCode;
  }

  if (err.code === 404) {
    return 404;
  }

  return 500;
}

function handleApiError(err, context) {
  const status = resolveStatus(err);

  if (status >= 500) {
    context.error(`unexpected error: ${err.message}`);
    context.error(err);
  } else if (status === 400) {
    context.log(`validation failed: ${err.message}`);
  } else {
    context.log(`request failed with status ${status}: ${err.message}`);
  }

  return errorResponse(err.message || 'Unexpected API error.', status);
}

async function createAsset(request, context) {
  const userId = getUserId();
  context.log(`asset upload started for userId=${userId}`);

  const { fields, file } = await parseMultipartRequest(request);
  validateImageFile(file);

  const id = uuidv4();
  const now = new Date().toISOString();
  const title = requireTitle(fields.title);
  const visibility = validateVisibility(fields.visibility);
  const blobName = `${userId}/${id}${getImageExtension(file)}`;
  const blobContainerClient = getBlobContainerClient();
  await blobContainerClient.createIfNotExists();

  const blockBlobClient = blobContainerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadFile(file.filepath, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    }
  });
  context.log(`blob uploaded assetId=${id} blobName=${blobName}`);

  // Blob Storage holds the binary object; Cosmos DB stores queryable metadata for CRUD screens and APIs.
  const asset = {
    id,
    assetId: id,
    userId,
    mediaType: 'image',
    title,
    description: cleanText(fields.description),
    tags: normalizeTags(cleanText(fields.tags)),
    visibility,
    blobName,
    blobUrl: blockBlobClient.url,
    createdAt: now,
    updatedAt: now,
    status: 'active'
  };

  const cosmosContainer = getCosmosContainer();
  await cosmosContainer.items.create(asset);
  context.log(`metadata created assetId=${id} userId=${userId}`);

  return jsonResponse(asset, 201);
}

async function listAssets(context) {
  const userId = getUserId();
  context.log(`asset list requested for userId=${userId}`);

  const cosmosContainer = getCosmosContainer();
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.userId = @userId AND c.status = @status ORDER BY c.createdAt DESC',
    parameters: [
      { name: '@userId', value: userId },
      { name: '@status', value: 'active' }
    ]
  };

  const { resources } = await cosmosContainer.items.query(querySpec, { partitionKey: userId }).fetchAll();
  context.log(`asset list returned count=${resources.length} userId=${userId}`);
  return jsonResponse({ assets: resources });
}

async function getAsset(id, context) {
  const assetId = requireAssetId(id);
  const userId = getUserId();
  context.log(`asset read requested assetId=${assetId} userId=${userId}`);

  const cosmosContainer = getCosmosContainer();
  const { resource } = await cosmosContainer.item(assetId, userId).read();

  if (!resource || resource.status !== 'active') {
    return errorResponse('Asset not found.', 404);
  }

  return jsonResponse(resource);
}

async function updateAsset(request, id, context) {
  const assetId = requireAssetId(id);
  const userId = getUserId();
  context.log(`asset update requested assetId=${assetId} userId=${userId}`);

  const cosmosContainer = getCosmosContainer();
  const { resource } = await cosmosContainer.item(assetId, userId).read();

  if (!resource || resource.status !== 'active') {
    return errorResponse('Asset not found.', 404);
  }

  const body = await readJson(request);
  const updated = {
    ...resource,
    title: body.title === undefined ? resource.title : requireTitle(body.title),
    description: typeof body.description === 'string' ? body.description.trim() : resource.description,
    tags: Array.isArray(body.tags) || typeof body.tags === 'string' ? normalizeTags(body.tags) : resource.tags,
    visibility: body.visibility === undefined ? resource.visibility : validateVisibility(body.visibility, resource.visibility),
    updatedAt: new Date().toISOString()
  };

  const { resource: saved } = await cosmosContainer.item(assetId, userId).replace(updated);
  context.log(`asset updated assetId=${assetId} userId=${userId}`);
  return jsonResponse(saved);
}

async function deleteAsset(id, context) {
  const assetId = requireAssetId(id);
  const userId = getUserId();
  context.log(`asset delete requested assetId=${assetId} userId=${userId}`);

  const cosmosContainer = getCosmosContainer();
  const { resource } = await cosmosContainer.item(assetId, userId).read();

  if (!resource || resource.status !== 'active') {
    return errorResponse('Asset not found.', 404);
  }

  await cosmosContainer.item(assetId, userId).delete();
  context.log(`metadata deleted assetId=${assetId} userId=${userId}`);

  let blobDeleted = false;
  let blobDeleteWarning;
  if (resource.blobName) {
    try {
      const blobContainerClient = getBlobContainerClient();
      const result = await blobContainerClient.getBlockBlobClient(resource.blobName).deleteIfExists();
      blobDeleted = Boolean(result.succeeded);
      context.log(`blob delete attempted assetId=${assetId} blobName=${resource.blobName} deleted=${blobDeleted}`);
    } catch (err) {
      blobDeleteWarning = 'Metadata deleted, but Blob cleanup failed.';
      context.log(`asset deleted with blob cleanup warning assetId=${assetId}: ${err.message}`);
    }
  }

  context.log(`asset deleted assetId=${assetId} userId=${userId}`);
  return jsonResponse({
    message: 'Asset deleted.',
    assetId,
    blobDeleted,
    blobDeleteWarning
  });
}

async function assetsHandler(request, context) {
  try {
    if (request.method === 'OPTIONS') {
      return noContentResponse();
    }

    if (request.method === 'POST') {
      return await createAsset(request, context);
    }

    return await listAssets(context);
  } catch (err) {
    return handleApiError(err, context);
  }
}

async function assetByIdHandler(request, context) {
  const id = request.params.id;

  try {
    if (request.method === 'OPTIONS') {
      return noContentResponse();
    }

    if (request.method === 'GET') {
      return await getAsset(id, context);
    }

    if (request.method === 'PUT') {
      return await updateAsset(request, id, context);
    }

    if (request.method === 'DELETE') {
      return await deleteAsset(id, context);
    }

    return errorResponse('Method not allowed.', 405);
  } catch (err) {
    if (err.code === 404) {
      return errorResponse('Asset not found.', 404);
    }

    return handleApiError(err, context);
  }
}

app.http('assets', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'assets',
  handler: assetsHandler
});

app.http('assetById', {
  methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'assets/{id}',
  handler: assetByIdHandler
});
