/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `npm run deploy` to publish your worker
 */
import { Hono } from "hono";

const app = new Hono();

app.get("/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const statusCode = 302;
    const id = c.req.param('urlId')
    
    const data = await kv.get(id);
    
    const obj = JSON.parse(data);
    const redirectUrl = obj.url.startsWith('http') ? obj.url : 'https://' + obj.url;
    
    return Response.redirect(redirectUrl, statusCode);
    
    if (!data) {
        return new Response("Key not found", { status: 404 });
    }
});

app.get("/delete/:urlId", async (c) => {
    const kv = c.env.REDIRS;
    const id = c.req.param('urlId')
    
    await kv.delete(id);
    
    return new Response("Deleted", { status: 200 });
});

app.post("/create", async (c) => {
    const kv = c.env.REDIRS;
    let { url, id } = await c.req.json();
    
    if (!url) {
        return new Response("Missing url", { status: 400 });
    }
    if (!id) {
        id = Math.random().toString(36).substring(2, 9);
    }

    const obj = { url };
    
    await kv.put(id, JSON.stringify(obj));
    
    return new Response("Created", { status: 201 });
});

export default app;