# Deploying the Empire OS dashboard to Vercel

This project ships the FastAPI backend alongside a Vite-powered React frontend that can be hosted on Vercel. The repository is configured as a monorepo so the dashboard can be imported directly into Vercel without restructuring the codebase.

## One-click import

1. Create a new project in Vercel and select this repository.
2. On the **Configure Project** screen, Vercel will detect the `vercel.json` file that lives at the repo root and automatically scope the build to the `frontend/` app.
3. Accept the defaults:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build --prefix frontend`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install --prefix frontend`
4. Provide the API endpoint the dashboard should call by adding an environment variable named `VITE_API_BASE_URL` that points to your FastAPI deployment (for example, `https://empire-os-api.example.com`).
5. Click **Deploy**. Vercel will install dependencies inside `frontend/`, build the Vite bundle, and host the static assets.

## Local development parity

The same commands defined in `vercel.json` work locally:

```bash
# Install dashboard dependencies
npm install --prefix frontend

# Run the dev server
npm run dev --prefix frontend

# Produce a production build
npm run build --prefix frontend
```

When the app runs on Vercel it serves static files, so API requests are proxied to whatever `VITE_API_BASE_URL` is configured. For local development the default base URL remains `http://localhost:8000`, matching the FastAPI server that ships with this repository.
