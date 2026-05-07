const { Readable } = require('stream');
const { formidable } = require('formidable');

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function parseMultipartRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    const err = new Error('Content-Type must be multipart/form-data.');
    err.statusCode = 400;
    throw err;
  }

  const body = Buffer.from(await request.arrayBuffer());
  const stream = Readable.from(body);
  stream.headers = Object.fromEntries(request.headers.entries());
  stream.method = request.method;
  stream.url = request.url;

  const form = formidable({
    keepExtensions: true,
    maxFiles: 1,
    maxFileSize: 10 * 1024 * 1024
  });

  return new Promise((resolve, reject) => {
    form.parse(stream, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        fields,
        file: firstValue(files.file)
      });
    });
  });
}

module.exports = {
  firstValue,
  parseMultipartRequest
};
