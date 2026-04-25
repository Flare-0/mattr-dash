/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 10;

const rateLimits = new Map();

const checkRateLimit = (c) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW * 1000;
    
    const userLimits = rateLimits.get(ip) || { count: 0, windowStart };
    
    if (now - userLimits.windowStart > RATE_LIMIT_WINDOW * 1000) {
        rateLimits.set(ip, { count: 1, windowStart: now });
        return true;
    }
    
    if (userLimits.count >= RATE_LIMIT_MAX) {
        return false;
    }
    
    rateLimits.set(ip, { count: userLimits.count + 1, windowStart: userLimits.windowStart });
    return true;
};

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

const protectedRoutes = new Hono();

protectedRoutes.use("*", async (c, next) => {
    if (!checkAuth(c)) {
        return c.text("Unauthorized", 401);
    }
    await next();
});

app.route("/", protectedRoutes);

// --- MANAGED ROUTES ---

protectedRoutes.delete("/:urlId", async (c) => {
    const id = c.req.param('urlId');
    if (!id) return c.text("Missing id", 400);

    await c.env.REDIRS.delete(id);
    return c.text("Deleted", 200);
});

protectedRoutes.post("/create", async (c) => {
    try {
        const kv = c.env.REDIRS;
        let { url, id } = await c.req.json();

        if (!url) return c.text("Missing url", 400);

        url = url.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
        }

        if (!id) {
            id = crypto.randomUUID().slice(0, 8);
        }

        const existing = await kv.get(id);
        if (existing) return c.text("ID already exists", 409);

        await kv.put(id, JSON.stringify({ url, clicks: [] }));
        return c.json({ message: "Created", id }, 201);
        
    } catch (error) {
        return c.text("Invalid JSON", 400);
    }
});

protectedRoutes.get("/stats/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const id = c.req.param('urlId');
    const data = await kv.get(id);

    if (!data) {
        return c.text("Key not found", 404);
    }

    const obj = JSON.parse(data);
    return c.json({
        id,
        url: obj.url,
        totalClicks: obj.clicks?.length || 0,
        clicks: obj.clicks || []
    });
});

protectedRoutes.get("/read", async (c) => {
    const kv = c.env.REDIRS;
    const cursor = c.req.query("cursor") || undefined;
    const limitStr = c.req.query("limit");
    let limit = 10;
    if (limitStr) {
        const parsed = parseInt(limitStr);
        if (!isNaN(parsed) && parsed > 0) {
            limit = parsed;
        }
    }

    const listResult = await kv.list({ cursor, limit: limit + 1 });

    const hasMore = listResult.keys.length > limit;
    let nextCursor = '';
    if (hasMore && listResult.list_metadata?.cursor) {
        nextCursor = String(listResult.list_metadata.cursor);
    }
    
    const keys = listResult.keys.slice(0, limit);

    const urlItems = await Promise.all(
        keys.map(async ({ name: id }) => {
            const data = await kv.get(id);
            if (!data) return { id, url: null, clicks: [] };

            try {
                const parsed = JSON.parse(data);
                return { 
                    id, 
                    url: parsed.url || null,
                    clicks: parsed.clicks || []
                };
            } catch {
                return { id, url: null, clicks: [] };
            }
        })
    );

    return c.json({ items: urlItems, cursor: nextCursor, hasMore }, 200);
});
protectedRoutes.get("/read/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const id = c.req.param('urlId');
    const data = await kv.get(id);
    if (!data) return c.text("Key not found", 404);
    const obj = JSON.parse(data);
    return c.json({ url: obj.url, clicks: obj.clicks || [] });
});
// --- PUBLIC ROUTES ---

app.get("/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const id = c.req.param('urlId');

    const data = await kv.get(id);
    if (!data) return c.text("Key not found", 404);

    const obj = JSON.parse(data);

    const cf = c.req.raw.cf || {};

    const clickData = {
        IP: c.req.header('cf-connecting-ip') || 'Unknown',
        timestamp: new Date().toISOString(),
        latitude: cf.latitude || 'Unknown',
        longitude: cf.longitude || 'Unknown',
        country: cf.country || 'Unknown',
        city: cf.city || 'Unknown',
        region: cf.region || 'Unknown',
        postalCode: cf.postalCode || 'Unknown',
        ISP: cf.asOrganization || 'Unknown'
    };

    obj.clicks = obj.clicks || [];
    obj.clicks.push(clickData);

    await kv.put(id, JSON.stringify(obj));

    const redirectUrl = obj.url.startsWith('http')
        ? obj.url
        : 'https://' + obj.url;

    return c.redirect(redirectUrl, 302);
});
export default app;