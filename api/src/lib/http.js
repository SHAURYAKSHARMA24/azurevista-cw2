function jsonResponse(body, status = 200) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    jsonBody: body
  };
}

function noContentResponse() {
  return {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  };
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message, status }, status);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

module.exports = {
  errorResponse,
  jsonResponse,
  noContentResponse,
  normalizeTags,
  readJson
};
