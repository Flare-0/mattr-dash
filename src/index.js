/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());
// 1. AUTH MIDDLEWARE: This runs before any route matching the pattern
// Helper function to check auth
const checkAuth = (c) => {
    const secret = c.req.header("X-Auth-Key");
    const apiKey = c.env.API_KEY;

    if (!apiKey) {
        console.warn("API_KEY environment variable not set");
        return false;
    }

    if (!secret) {
        return false;
    }

    return secret === apiKey;
};

app.use("/create", async (c, next) => {
    if (!checkAuth(c)) {
        return c.text("Unauthorized", 401);
    }
    await next();
});

app.use("/delete/:urlId", async (c, next) => {
    if (!checkAuth(c)) {
        return c.text("Unauthorized", 401);
    }
    await next();
});


// --- PROTECTED ROUTES ---

app.get("/delete/:urlId", async (c) => {
    const id = c.req.param('urlId');
    if (!id) return c.text("Missing id", 400);

    await c.env.REDIRS.delete(id);
    return c.text("Deleted", 200);
});

app.post("/create", async (c) => {
    try {
        const kv = c.env.REDIRS;
        let { url, id } = await c.req.json();

        if (!url) return c.text("Missing url", 400);

        if (!id) {
            id = Math.random().toString(36).substring(2, 9);
        }

        await kv.put(id, JSON.stringify({ url }));
        return c.json({ message: "Created", id }, 201);
    } catch (error) {
        return c.text("Invalid JSON", 400);
    }
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
    console.log(c.req)
    // Log click data
    const clickData = {
        IP: c.req.raw.headers.get('cf-connecting-ip') || 'Unknown',
        timestamp: new Date().toISOString(),
        userAgent: c.req.header('user-agent') || 'Unknown',
        latitude: c.req.raw.cf?.latitude ?? 'Unknown',
        longitude: c.req.raw.cf?.longitude ?? 'Unknown',
        ISP: c.req.raw.headers.get('cf-asn') || 'Unknown'
    };
    
    // Update clicks array in KV
    obj.clicks = obj.clicks || [];
    obj.clicks.push(clickData);
    await kv.put(id, JSON.stringify(obj));
    
    const redirectUrl = obj.url.startsWith('http') ? obj.url : 'https://' + obj.url;
    return c.redirect(redirectUrl, 302);
});
const structureOfRedirs = {
    "url": "antigravity.google",
    "clicks": [
        {
            "IP": "192.168.1.1",
            "timestamp": "2024-06-01T12:00:00Z",
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
            "location": "New York, USA",
            "ISP": "Example ISP"
        }
    ]
}
export default app;