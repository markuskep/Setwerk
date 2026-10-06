# Setwerk

Fitness web app deployed with Netlify.

## Netlify deployment

The production-ready static website is located in:

`Setwerk-Webapp-1.2.0-Projektdateien/dist`

Deployment settings are defined in the root-level `netlify.toml`, so Netlify can deploy the repository without manually configuring a publish directory.

- Production branch: `main`
- Build command: none
- Publish directory: `Setwerk-Webapp-1.2.0-Projektdateien/dist`
- Entry point: `index.html`

Do not upload ZIP deploys for normal releases. Push changes to `main` and let Netlify Continuous Deployment publish them.
