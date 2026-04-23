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
   
    // Log click data
    let ip = c.req.header('cf-connecting-ip') || 'Unknown';
    let latitude = c.req.raw.cf?.latitude ?? 'Unknown';
    let longitude = c.req.raw.cf?.longitude ?? 'Unknown';
    let country = c.req.raw.cf?.country ?? 'Unknown';
    let city = c.req.raw.cf?.city ?? 'Unknown';
    let region = c.req.raw.cf?.region ?? 'Unknown';
    let postalCode = c.req.raw.cf?.postalCode ?? 'Unknown';
    let isp = c.req.raw.headers.get('cf-asn') || 'Unknown';

    if (ip === 'Unknown') {
        try {
            const response = await fetch(`https://ipapi.co/json/`);
            const data = await response.json();
            ip = data.ip || 'Unknown';
        } catch (error) {
            console.error('Failed to fetch IP data from ipapi:', error);
        }
    }

    const clickData = {
        IP: ip,
        timestamp: new Date().toISOString(),
        userAgent: c.req.header('user-agent') || 'Unknown',
        latitude: latitude,
        longitude: longitude,
        Location: `${country}, ${city}, ${region}, ${postalCode}`,
        ISP: isp
    };
    
    // Update clicks array in KV
    obj.clicks = obj.clicks || [];
    obj.clicks.push(clickData);
    await kv.put(id, JSON.stringify(obj));
    
    const redirectUrl = obj.url.startsWith('http') ? obj.url : 'https://' + obj.url;
    return c.redirect(redirectUrl, 302);
});
export default app;