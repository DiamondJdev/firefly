# Firefly landing page

Run from this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The single Next.js route is in `app/page.tsx`.
The workflow selector switches between illustrative CLI, Git, and Dockerfile examples.
The platform capabilities are presented as plans, based on the parent repository's blueprint.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The page has no authentication, deployment API, or signup form. Its primary action opens the workflow section. Blueprint links serve `public/blueprint.txt`.

The raster studies in `public/images` were created with the built-in ImageGen tool. They illustrate the Firefly identity and the proposed hardware, rather than documenting the owner's actual machines. The page credits them in its footer.
