/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */
import { Hono } from "hono";

const app = new Hono();
// 1. AUTH MIDDLEWARE: This runs before any route matching the pattern
app.use("/create", async (c, next) => {
    const secret = c.req.header("X-Auth-Key");
    if (secret !== c.env.API_KEY) {
        return c.text("Unauthorized", 401);
    }
    await next();
});

app.use("/delete/*", async (c, next) => {
    const secret = c.req.header("X-Auth-Key");
    if (secret !== c.env.API_KEY) {
        return c.text("Unauthorized", 401);
    }
    await next();
});

// --- PUBLIC ROUTES ---

app.get("/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const id = c.req.param('urlId');
    const data = await kv.get(id);
    
    if (!data) {
        return c.text("Key not found", 404);
    }

    const obj = JSON.parse(data);
    const redirectUrl = obj.url.startsWith('http') ? obj.url : 'https://' + obj.url;
    
    return c.redirect(redirectUrl, 302);
});

// --- PROTECTED ROUTES ---

app.get("/delete/:urlId", async (c) => {
    const id = c.req.param('urlId');
    if(!id) return c.text("Missing id", 400);

    await c.env.REDIRS.delete(id);
    return c.text("Deleted", 200);
});

app.post("/create", async (c) => {
    const kv = c.env.REDIRS;
    let { url, id } = await c.req.json();
    
    if (!url) return c.text("Missing url", 400);

    if (!id) {
        id = Math.random().toString(36).substring(2, 9);
    }

    await kv.put(id, JSON.stringify({ url }));
    return c.json({ message: "Created", id }, 201);
});

export default app;