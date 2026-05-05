/**
 * Cloudflare Worker: GitHub API Proxy
 * Securely proxies requests to GitHub and adds the Authorization header.
 * 
 * Deployment:
 * 1. Create a new Worker in Cloudflare.
 * 2. Add a Secret named `GITHUB_TOKEN` with your GitHub PAT.
 * 3. Deploy.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Construct the GitHub API URL
    // We expect the path to be like /repos/owner/repo/...
    const githubUrl = `https://api.github.com${url.pathname}${url.search}`;
    
    // Handle OPTIONS for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    try {
      const headers = new Headers(request.headers);
      
      // Inject the secret token safely on the server-side
      headers.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);
      headers.set("Accept", "application/vnd.github.v3+json");
      headers.set("User-Agent", "Cloudflare-Worker-GitHub-Proxy");

      // Special handling for asset uploads (uploads.github.com vs api.github.com)
      let finalUrl = githubUrl;
      if (url.pathname.includes("/assets") && request.method === "POST") {
        finalUrl = githubUrl.replace("api.github.com", "uploads.github.com");
      }

      const githubResponse = await fetch(finalUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // Mirror the response back to the client with CORS
      const response = new Response(githubResponse.body, githubResponse);
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
