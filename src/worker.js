// Cloudflare Worker entry point.
// Files in public/ are served as static assets automatically; anything that
// isn't a file reaches this handler. The progress-sync API arrives in build
// step 3; until then progress is kept on the phone.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, app: "octave" });
    }
    return env.ASSETS.fetch(request);
  },
};
