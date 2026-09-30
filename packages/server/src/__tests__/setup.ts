/**
 * Test setup.
 *
 * Forces test-mode environment values BEFORE any module reads config, because
 * config/env.ts validates and freezes its values at import time.
 *
 * Uses an in-memory MongoDB so the suite never touches a real database, real
 * user data, or the network.
 */

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '4010';
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/skillmap-test';
process.env['DB_MODE'] = 'local';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-that-is-definitely-long-enough-32';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-that-is-also-long-enough-32';
process.env['JWT_ACCESS_TTL'] = '15m';
process.env['JWT_REFRESH_TTL'] = '7d';
process.env['BCRYPT_ROUNDS'] = '8';
process.env['ADMIN_EMAIL'] = 'admin@test.skillmap.ai';
process.env['ADMIN_PASSWORD'] = 'TestAdminPass123';
process.env['AI_MODE'] = 'demo';
process.env['OPENAI_API_KEY'] = '';
process.env['AI_BUDGET_USD'] = '0';
process.env['UPLOAD_DIR'] = './uploads-test';
process.env['CORS_ORIGINS'] = 'http://localhost:5173';
process.env['RATE_LIMIT_LOGIN'] = '1000';
process.env['RATE_LIMIT_UPLOAD'] = '1000';
process.env['RATE_LIMIT_ASSISTANT'] = '1000';
process.env['RATE_LIMIT_GLOBAL'] = '10000';
