# Deploying ATLAS to GitHub Pages (Step-by-Step)

You have two easy ways to host ATLAS for free on GitHub Pages:

---

### Option A: 1-Click Hosting from this repository (Recommended)
Because the `docs/` folder is already committed into this repository:
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: add github pages deployment bundle"
   git push origin main
   ```
2. Open your repository on GitHub.com in your browser.
3. Click **Settings** (tab at the top right) $\to$ click **Pages** (in the left sidebar).
4. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`
   - **Branch**: Select `main` (or `master`)
   - **Folder**: Select `/docs`
   - Click **Save**.
5. In ~60 seconds, your game will be live at:
   `https://<your-github-username>.github.io/<repo-name>/`

---

### Option B: Upload the `github-pages-deployment` folder to a separate repo
If you want to host ATLAS in its own dedicated static repository:
1. Create a new GitHub repository (e.g. `atlas-game`).
2. Upload all files from the `github-pages-deployment` folder into the root of that new repository:
   - `index.html`
   - `lobby.html`
   - `game.html`
   - `404.html`
   - `manifest.json`
   - `css/`
   - `js/`
3. Go to **Settings** $\to$ **Pages** $\to$ select branch `main` $\to$ folder `/(root)` $\to$ click **Save**.
4. Your multiplayer game is live!

