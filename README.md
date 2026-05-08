# AzureVista CW2

AzureVista is a COM682 Cloud Native Development Coursework 2 image-sharing application. It implements a React/Vite frontend and a Node.js Azure Functions REST API that stores image files in Azure Blob Storage and metadata records in Azure Cosmos DB for NoSQL. Application Insights is connected to the Function App so CRUD activity can be shown as monitoring evidence in the final video.

Deployed backend API base URL:

```text
https://func-azurevista-cw2-shaurya-bxa3ere7bhaehsfy.swedencentral-01.azurewebsites.net/api
```

## CW2 Requirement Mapping

| CW2 requirement | AzureVista implementation evidence |
| --- | --- |
| Implement the CW1 cloud-native design | Working image asset app with frontend, REST API, Blob Storage, Cosmos DB, and deployed Azure Function health endpoint |
| Scalable binary/file storage | Azure Blob Storage container `media` stores uploaded image files |
| Cloud-native NoSQL metadata | Cosmos DB database `azurevista-db`, container `assets`, partition key `/userId` |
| REST API CRUD endpoints | Azure Functions endpoints for create, read, update, delete, and health checks |
| Endpoint URIs for images and metadata | `/api/assets` creates Blob files and Cosmos DB metadata records with `blobUrl` |
| CI/CD using Git | GitHub repository and deployment run evidence should be shown in the video |
| Advanced Azure services | Application Insights logs requests, validation failures, uploads, updates, deletes, and unexpected errors |
| Testing and evidence | README test checklist, Postman/browser checks, frontend build, backend syntax check, Azure portal verification |

## Azure Resources Used

| Resource | Purpose |
| --- | --- |
| Resource group `rg-azurevista-cw2` | Groups the AzureVista CW2 cloud resources |
| Azure Function App | Hosts the Node.js REST API |
| Azure Blob Storage | Stores uploaded image binaries in container `media` |
| Azure Cosmos DB for NoSQL | Stores image metadata in database `azurevista-db`, container `assets` |
| Application Insights | Captures API requests, logs, failures, and performance evidence |
| GitHub | Source control and CI/CD evidence |
| Azure App Service | Hosts the built React frontend as a static production site |

## Architecture Summary

The browser frontend sends CRUD requests to the Azure Functions API using `VITE_API_BASE_URL`. On upload, the API validates the image and metadata, writes the binary image to Blob Storage, then creates a Cosmos DB document with the Blob URL and searchable metadata. Read, update, and delete requests use the fixed demo partition user `demo-user`. Delete removes the Cosmos DB record and attempts Blob cleanup. API logs are emitted with `context.log` and `context.error` for Application Insights evidence.

Created asset documents use this shape:

```json
{
  "id": "asset_uuid",
  "assetId": "asset_uuid",
  "userId": "demo-user",
  "mediaType": "image",
  "title": "string",
  "description": "string",
  "tags": ["string"],
  "visibility": "public",
  "blobName": "string",
  "blobUrl": "string",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "status": "active"
}
```

## Local Setup

Prerequisites:

- Node.js and npm
- Azure Functions Core Tools v4
- Azure resources for Blob Storage and Cosmos DB

Install dependencies:

```powershell
cd frontend
npm.cmd install

cd ..\api
npm.cmd install
```

Create local API settings:

```powershell
cd api
Copy-Item local.settings.example.json local.settings.json
```

Add real values to `api/local.settings.json`. Do not commit that file.

Run the API:

```powershell
cd api
func start
```

Run the frontend in a second terminal. For local development, create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:7071/api` if the API is running locally, or use the deployed API URL if testing against Azure:

```powershell
cd frontend
npm.cmd run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:7071/api`
- Health check: `http://localhost:7071/api/health`

## Environment Variables

Backend values are read from `api/local.settings.json` locally and Function App configuration in Azure:

| Name | Purpose |
| --- | --- |
| `AzureWebJobsStorage` | Azure Functions host storage |
| `FUNCTIONS_WORKER_RUNTIME` | Must be `node` |
| `BLOB_CONNECTION_STRING` | Storage account connection string |
| `BLOB_CONTAINER_NAME` | Blob container name, currently `media` |
| `COSMOS_ENDPOINT` | Cosmos DB account endpoint |
| `COSMOS_KEY` | Cosmos DB primary or secondary key |
| `COSMOS_DATABASE` | Cosmos database name, currently `azurevista-db` |
| `COSMOS_CONTAINER` | Cosmos container name, currently `assets` |
| `USER_ID` | Demo partition user, currently `demo-user` |

Frontend value:

| Name | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base API URL, for example `http://localhost:7071/api` locally or the deployed Function API URL |

Production frontend value in `frontend/.env.production`:

```text
VITE_API_BASE_URL=https://func-azurevista-cw2-shaurya-bxa3ere7bhaehsfy.swedencentral-01.azurewebsites.net/api
```

## API Endpoints

| Method | Endpoint | Success response | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `200` JSON | API health check |
| `POST` | `/api/assets` | `201` JSON | Upload image to Blob Storage and create Cosmos DB metadata |
| `GET` | `/api/assets` | `200` JSON | List active assets for `demo-user` |
| `GET` | `/api/assets/{id}` | `200` JSON | Read one asset metadata record |
| `PUT` | `/api/assets/{id}` | `200` JSON | Update title, description, tags, and visibility |
| `DELETE` | `/api/assets/{id}` | `200` JSON | Delete Cosmos DB metadata and attempt Blob file cleanup |

Validation errors return clean JSON with HTTP `400`, including missing file, non-image file, missing title, invalid visibility, and missing asset id.

## Deployment Steps

1. Push the latest project to GitHub.
2. Deploy the `api` folder to the Azure Function App using VS Code Azure extension, Azure Functions Core Tools, or GitHub Actions.
3. Add the backend environment variables to the Function App Configuration page.
4. Confirm the deployed health endpoint returns JSON from `/api/health`.
5. Build the frontend with `npm.cmd run build`.
6. Deploy the `frontend` app to Azure App Service because Azure Static Web Apps was blocked by the student subscription region policy.
7. Confirm App Service uses `VITE_API_BASE_URL` from `frontend/.env.production` during the production build.
8. Add the new App Service origin to the Function App CORS allowed origins.
9. Confirm Application Insights is connected to the Function App and receiving request/log data.
10. Capture the successful GitHub CI/CD deployment run for the CW2 video.

## Azure App Service Frontend Deployment

Azure Static Web Apps was the preferred static-hosting target, but it was blocked by Azure subscription region policy. The frontend is therefore deployed with Azure App Service. This still provides a deployed Azure-hosted web app for the running React frontend, while the backend remains hosted separately on Azure Functions.

Use these values when creating the frontend App Service:

| Setting | Value |
| --- | --- |
| App Service name | `app-azurevista-frontend-shaurya` |
| Publish | Code |
| Runtime stack | Node 22 LTS |
| Operating system | Linux |
| Region | Any region allowed by the subscription policy |
| Startup command | `npm start` |
| App setting | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` |

The frontend build output is served from `frontend/dist` using the lightweight `serve` package. `npm start` runs `frontend/server.cjs`, which starts the equivalent of this command while also working on local Windows development machines:

```text
serve -s dist -l ${PORT:-8080}
```

The server uses Azure's `PORT` environment variable when present and falls back to `8080` locally.

After App Service is created, copy its public URL, for example `https://app-azurevista-frontend-shaurya.azurewebsites.net`, and add it in the Azure Function App CORS settings. Keep local origins only if you still need them for testing.

## CI/CD Evidence

This repo includes `.github/workflows/ci.yml`, which installs dependencies, builds the React frontend, and runs the API syntax check on pushes and pull requests to `main`. Azure App Service Deployment Center also added `.github/workflows/main_app-azurevista-frontend-shaurya.yml` for frontend deployment.

The App Service workflow must use Node 22 and run npm commands from `frontend`, not the repository root. It builds the Vite frontend, packages `dist`, `package.json`, `package-lock.json`, and `server.cjs`, then deploys that package to App Service.

Deployment Center created federated Azure login secrets with names beginning `AZUREAPPSERVICE_CLIENTID_`, `AZUREAPPSERVICE_TENANTID_`, and `AZUREAPPSERVICE_SUBSCRIPTIONID_`. Keep those GitHub secrets in place for CI/CD.

The deployment workflow runs on pushes to `main` and can also be started manually with `workflow_dispatch`. In the video, show a successful workflow run and the deployed App Service URL.

## Testing Checklist

- `GET /api/health` returns `status: "ok"`.
- `POST /api/assets` rejects a missing file with `400`.
- `POST /api/assets` rejects a non-image file with `400`.
- `POST /api/assets` rejects a missing title with `400`.
- `POST /api/assets` rejects invalid visibility with `400`.
- Valid upload creates a Blob file in container `media`.
- Valid upload creates a Cosmos DB item with `id`, `assetId`, `userId`, `blobUrl`, timestamps, and `status`.
- `GET /api/assets` lists active assets.
- `GET /api/assets/{id}` returns the selected asset.
- `PUT /api/assets/{id}` updates metadata and `updatedAt`.
- `DELETE /api/assets/{id}` removes the Cosmos DB record and attempts Blob cleanup.
- Frontend build completes with `npm.cmd run build`.
- Backend syntax check completes with `npm.cmd run check`.
- Application Insights shows requests and custom logs for upload, update, delete, validation failure, and unexpected errors.

Recommended final command checks:

```powershell
cd frontend
npm.cmd install
npm.cmd run build

cd ..\api
npm.cmd install
npm.cmd run check
```

## CW2 Demo Flow

Suggested 5-minute structure:

| Time | Evidence |
| --- | --- |
| 0:00-0:30 | Introduce AzureVista and show the deployed frontend URL |
| 0:30-1:45 | Upload an image, refresh/list it, edit metadata, and delete it |
| 1:45-2:30 | Show REST endpoints including `/api/health` and `/api/assets` |
| 2:30-3:20 | Show Blob Storage container `media` and Cosmos DB `azurevista-db` / `assets` |
| 3:20-4:10 | Show Application Insights request logs and custom log messages |
| 4:10-4:45 | Show GitHub history and successful CI/CD/App Service deployment workflow run |
| 4:45-5:00 | Summarise how the app meets the CW2 cloud-native design |

## Video Evidence Checklist

- Show the running AzureVista frontend with title, upload form, gallery, edit, delete, refresh, and messages.
- Show REST API URIs in the browser, Postman, or Function App endpoint list.
- Show Azure Function App configuration with secrets hidden.
- Show Blob Storage container `media` before or after upload.
- Show Cosmos DB database `azurevista-db`, container `assets`, and item JSON.
- Show Application Insights request logs and custom `context.log` messages.
- Show GitHub repository history and CI/CD deployment run.
- Keep the walkthrough under 5 minutes with clear narration and visible successful CRUD operations.

Useful Application Insights log phrases to search for after generating traffic:

- `health check requested`
- `asset upload started`
- `validation failed`
- `blob uploaded`
- `metadata created`
- `asset list returned`
- `asset updated`
- `asset deleted`

## Limitations and Future Improvements

- Current version focuses on image assets.
- Video support would need transcoding, streaming-friendly storage patterns, and larger upload handling.
- Production sharing should use SAS URLs, private containers, or authenticated API access instead of public Blob URLs.
- Authentication, authorization, and content moderation are future improvements.
- Azure CDN or Azure Front Door can be added for global media delivery.
- A production release should add automated integration tests and stricter per-user access control.
