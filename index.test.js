import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'https://dev.mattr.art';
const API_KEY = "77737774" // You'll provide this
const TEST_URL = 'https://example.com/test';
const TEST_ID = `test-${Date.now()}`;
let createdId = '';

describe('URL Shortener API', () => {
    // ===== CREATE ENDPOINT TESTS =====
    describe('POST /create', () => {
        it('should create a shortened URL with custom ID', async () => {
            const response = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: TEST_URL,
                    id: TEST_ID
                })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.message).toBe('Created');
            expect(data.id).toBe(TEST_ID);
            createdId = TEST_ID;
        });

        it('should auto-generate ID if not provided', async () => {
            const response = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: TEST_URL })
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.id).toBeTruthy();
            expect(data.id.length).toBeGreaterThan(0);
        });

        it('should return 400 if URL is missing', async () => {
            const response = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: 'test-missing-url' })
            });

            expect(response.status).toBe(400);
            const text = await response.text();
            expect(text).toContain('Missing url');
        });

        it('should return 401 if API key is missing', async () => {
            const response = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: TEST_URL })
            });

            expect(response.status).toBe(401);
            const text = await response.text();
            expect(text).toContain('Unauthorized');
        });

        it('should return 400 if JSON is invalid', async () => {
            const response = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: 'invalid json{'
            });

            expect(response.status).toBe(400);
        });
    });

    // ===== REDIRECT ENDPOINT TESTS =====
    describe('GET /:urlId (Redirect)', () => {
        it('should redirect existing shortened URL', async () => {
            const response = await fetch(`${BASE_URL}/bau2fqd`, {
                redirect: 'manual'
            });

            expect(response.status).toBe(302);
            expect(response.headers.get('location')).toBeTruthy();
        });

        it('should log click data on redirect', async () => {
            // Create a test URL first
            const createRes = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: 'https://click-test.example.com',
                    id: `click-test-${Date.now()}`
                })
            });

            const created = await createRes.json();
            const testId = created.id;

            // Access the shortened URL to log a click
            await fetch(`${BASE_URL}/${testId}`, {
                redirect: 'manual'
            });

            // Wait a moment for KV to update
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check stats
            const statsRes = await fetch(`${BASE_URL}/stats/${testId}`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            const stats = await statsRes.json();
            expect(stats.totalClicks).toBeGreaterThan(0);
            expect(stats.clicks[0]).toHaveProperty('IP');
            expect(stats.clicks[0]).toHaveProperty('timestamp');
            expect(stats.clicks[0]).toHaveProperty('userAgent');
        });

        it('should return 404 for non-existent URL', async () => {
            const response = await fetch(`${BASE_URL}/nonexistent-url-12345`, {
                redirect: 'manual'
            });

            expect(response.status).toBe(404);
            const text = await response.text();
            expect(text).toContain('Key not found');
        });
    });

    // ===== STATS ENDPOINT TESTS =====
    describe('GET /stats/:urlId', () => {
        it('should return stats for existing URL', async () => {
            const response = await fetch(`${BASE_URL}/stats/bau2fqd`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('url');
            expect(data).toHaveProperty('totalClicks');
            expect(data).toHaveProperty('clicks');
            expect(Array.isArray(data.clicks)).toBe(true);
        });

        it('should include click details', async () => {
            const response = await fetch(`${BASE_URL}/stats/bau2fqd`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            const data = await response.json();
            if (data.clicks.length > 0) {
                const click = data.clicks[0];
                expect(click).toHaveProperty('IP');
                expect(click).toHaveProperty('timestamp');
                expect(click).toHaveProperty('userAgent');
                expect(click).toHaveProperty('country');
            }
        });

        it('should return 404 for non-existent URL', async () => {
            const response = await fetch(`${BASE_URL}/stats/nonexistent-stats-12345`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            expect(response.status).toBe(404);
        });

        it('should return 401 without API key', async () => {
            const response = await fetch(`${BASE_URL}/stats/bau2fqd`);

            expect(response.status).toBe(401);
        });
    });

    // ===== READ ENDPOINT TESTS =====
    describe('GET /read (List URLs)', () => {
        it('should list all URLs with pagination', async () => {
            const response = await fetch(`${BASE_URL}/read?limit=10`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('items');
            expect(data).toHaveProperty('cursor');
            expect(data).toHaveProperty('hasMore');
            expect(Array.isArray(data.items)).toBe(true);
        });

        it('should include URL metadata in list', async () => {
            const response = await fetch(`${BASE_URL}/read?limit=10`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            const data = await response.json();
            if (data.items.length > 0) {
                const item = data.items[0];
                expect(item).toHaveProperty('id');
                expect(item).toHaveProperty('url');
                expect(item).toHaveProperty('clicks');
            }
        });

        it('should support cursor pagination', async () => {
            const firstRes = await fetch(`${BASE_URL}/read?limit=5`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            const firstData = await firstRes.json();
            if (firstData.hasMore && firstData.cursor) {
                const secondRes = await fetch(
                    `${BASE_URL}/read?cursor=${firstData.cursor}&limit=5`,
                    { headers: { 'X-Auth-Key': API_KEY } }
                );

                expect(secondRes.status).toBe(200);
                const secondData = await secondRes.json();
                expect(secondData.items).toBeTruthy();
            }
        });

        it('should return 401 without API key', async () => {
            const response = await fetch(`${BASE_URL}/read`);

            expect(response.status).toBe(401);
        });

        it('should respect limit parameter', async () => {
            const response = await fetch(`${BASE_URL}/read?limit=3`, {
                headers: { 'X-Auth-Key': API_KEY }
            });

            const data = await response.json();
            expect(data.items.length).toBeLessThanOrEqual(3);
        });
    });

    // ===== DELETE ENDPOINT TESTS =====
    describe('GET /delete/:urlId', () => {
        it('should delete a shortened URL', async () => {
            // Create a URL to delete
            const createRes = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: 'https://delete-test.example.com',
                    id: `delete-${Date.now()}`
                })
            });

            const created = await createRes.json();
            const deleteId = created.id;

            // Delete it
            const deleteRes = await fetch(`${BASE_URL}/delete/${deleteId}`, {
                method: 'GET',
                headers: { 'X-Auth-Key': API_KEY }
            });

            expect(deleteRes.status).toBe(200);
            const text = await deleteRes.text();
            expect(text).toContain('Deleted');

            // Verify it's deleted
            await new Promise(resolve => setTimeout(resolve, 500));
            const checkRes = await fetch(`${BASE_URL}/${deleteId}`, {
                redirect: 'manual'
            });
            expect(checkRes.status).toBe(404);
        });

        it('should return 401 without API key', async () => {
            const response = await fetch(`${BASE_URL}/delete/bau2fqd`);

            expect(response.status).toBe(401);
        });
    });

    // ===== INTEGRATION TESTS =====
    describe('Integration Tests', () => {
        it('should complete full workflow: create -> access -> check stats -> delete', async () => {
            const workflowId = `workflow-${Date.now()}`;
            const workflowUrl = 'https://workflow-test.example.com';

            // 1. Create
            const createRes = await fetch(`${BASE_URL}/create`, {
                method: 'POST',
                headers: {
                    'X-Auth-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: workflowUrl, id: workflowId })
            });
            expect(createRes.status).toBe(201);

            // 2. Redirect (access)
            const redirectRes = await fetch(`${BASE_URL}/${workflowId}`, {
                redirect: 'manual'
            });
            expect(redirectRes.status).toBe(302);

            // 3. Wait and check stats
            await new Promise(resolve => setTimeout(resolve, 1000));
            const statsRes = await fetch(`${BASE_URL}/stats/${workflowId}`, {
                headers: { 'X-Auth-Key': API_KEY }
            });
            expect(statsRes.status).toBe(200);
            const stats = await statsRes.json();
            expect(stats.totalClicks).toBeGreaterThan(0);

            // 4. Delete
            const deleteRes = await fetch(`${BASE_URL}/delete/${workflowId}`, {
                method: 'GET',
                headers: { 'X-Auth-Key': API_KEY }
            });
            expect(deleteRes.status).toBe(200);
        });
    });
});