const { app } = require('@azure/functions');
const { jsonResponse } = require('../lib/http');

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (request, context) => {
    context.log('health check requested');

    return jsonResponse({
      status: 'ok',
      app: 'AzureVista CW2 API',
      time: new Date().toISOString()
    });
  }
});
