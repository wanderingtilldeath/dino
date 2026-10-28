# Deploy to Render + Neon

The app is one Docker image. It needs one secret, `DATABASE_URL`. Tables are created on first boot.

## 1. Neon (database)
1. Create a project. Pick the AWS region that matches the Render region in `render.yaml` (`ohio` = `us-east-2`).
2. Open **Connect** and copy the **pooled** connection string (host contains `-pooler`):
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
3. If the app logs a connect error mentioning `channel_binding`, delete `&channel_binding=require` from the string.
4. Keep the string private: do not commit it or paste it into chat.

## 2. GitHub (Render pulls from here)
Create an **empty private** repo on github.com, then in this folder:
```
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 3. Render
1. **New > Blueprint**, pick the repo. It reads `render.yaml`.
2. Paste the Neon string when it asks for `DATABASE_URL`.
3. Deploy. Logs should end with `listening on :10000`.

## 4. Check
- Open the `https://<name>.onrender.com` URL, play a run, see your rank.
- Neon SQL editor: `SELECT * FROM scores;` shows the row.
- Redeploy once and confirm the scores are still there.

## Notes
- Free Render sleeps after 15 min idle (about 1 min to wake). Change `plan: free` to `plan: starter` for always-on.
- Neon free also scales to zero; the first request after a quiet period is slower. The app waits up to 30s for the database on boot.
- Writes are limited to ~10/s overall. Scores are client-reported, so the leaderboard can be faked.
