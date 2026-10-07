# NPK Soil Balance

A web app that simulates the daily N-P-K balance in a rice field, recommends fertilizer changes, and asks Gemini for an in-depth analysis.

## Project structure

```
npk-soil-balance/
├── index.html        page layout
├── style.css         styles (light/dark)
├── engine.js         calculation core (runs in the browser)
├── app.js            interface, charts, recommendations, calls /api/analyze
├── api/
│   └── analyze.js    Vercel Function: holds the Gemini key and calls Gemini
├── example.js        run the model from the command line: node example.js
├── package.json
├── vercel.json       gives the AI function up to 30 s
├── .env.example      template for local secrets
└── .gitignore        keeps .env.local and .vercel out of GitHub
```

The Gemini API key is used **only** in `api/analyze.js` on Vercel's server. It is never sent to the browser and never stored in GitHub.

## Deploy

### 1. Put the code on GitHub

1. Create a new **empty** repository on github.com (e.g. `npk-soil-balance`). Do not add a README there.
2. In a terminal, inside this folder:

```bash
git init
git add .
git commit -m "NPK Soil Balance first version"
git branch -M main
git remote add origin https://github.com/<your-username>/npk-soil-balance.git
git push -u origin main
```

Check on GitHub that **no** `.env` or `.env.local` file was uploaded.

### 2. Import the repository into Vercel

1. Go to vercel.com → **Add New… → Project**.
2. Choose **Import Git Repository** and pick `npk-soil-balance` (connect your GitHub account if asked).
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Open **Environment Variables** and add:
   - Name: `GEMINI_API_KEY`  Value: your Gemini key
   - (optional) Name: `GEMINI_MODEL`  Value: e.g. `gemini-3.5-flash-lite` for lower cost
5. Click **Deploy**. Your site will be at `https://npk-soil-balance-<something>.vercel.app`.

If you add or change an environment variable later, redeploy (Deployments → ⋯ → Redeploy) for it to take effect.

### 3. Test

Open the site, keep the default plan, and press **🤖 Get in-depth AI analysis**. You should see Gemini's analysis within a few seconds.

If you see an error instead, open Vercel → your project → **Logs** and look for lines starting with `Gemini error` or `analyze failed`.

### 4. Update the site later

Edit files, then:

```bash
git add .
git commit -m "describe the change"
git push
```

Vercel redeploys automatically on every push to `main`.

## Run locally (optional)

```bash
npm i -g vercel
vercel link              # connect this folder to your Vercel project
cp .env.example .env.local   # then put your key in .env.local
vercel dev               # open http://localhost:3000
```

## Protecting your key

- The function only accepts requests whose `Origin` matches your own site, and only the fixed analysis task (it cannot be used as a general chatbot).
- This does not stop someone calling the endpoint directly with a script. Limit the damage by lowering the Gemini API quota for the key's Google Cloud project and adding a budget alert, so misuse cannot cost much.
- Never paste the key into `app.js`, `index.html` or any file in the repository.
