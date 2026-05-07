const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');

let containerClient;
let cosmosContainer;

function requireSetting(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required setting: ${name}`);
  }
  return value;
}

function getBlobContainerClient() {
  if (!containerClient) {
    const connectionString = requireSetting('BLOB_CONNECTION_STRING');
    const containerName = requireSetting('BLOB_CONTAINER_NAME');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
  }

  return containerClient;
}

function getCosmosContainer() {
  if (!cosmosContainer) {
    const endpoint = requireSetting('COSMOS_ENDPOINT');
    const key = requireSetting('COSMOS_KEY');
    const databaseName = requireSetting('COSMOS_DATABASE');
    const containerName = requireSetting('COSMOS_CONTAINER');
    const client = new CosmosClient({ endpoint, key });
    cosmosContainer = client.database(databaseName).container(containerName);
  }

  return cosmosContainer;
}

function getUserId() {
  return process.env.USER_ID || 'demo-user';
}

module.exports = {
  getBlobContainerClient,
  getCosmosContainer,
  getUserId
};

