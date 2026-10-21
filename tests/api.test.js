// These tests need no running MongoDB: they cover validation, auth and role checks
// that run before any database query. Add mongodb-memory-server for full integration tests.
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { plain } = require('../services/sanitize');

describe('health and security headers', () => {
  it('returns ok with helmet headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('validation', () => {
  it('rejects bad registration input with field details', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
  it('rejects login without credentials', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });
});

describe('authentication', () => {
  it.each([
    ['post', '/api/articles'],
    ['get', '/api/articles/mine'],
    ['get', '/api/articles/review-queue'],
    ['get', '/api/admin/users'],
    ['post', '/api/uploads'],
    ['post', '/api/ai/suggest'],
  ])('%s %s requires a token', async (method, url) => {
    expect((await request(app)[method](url)).status).toBe(401);
  });
  it('rejects a forged token', async () => {
    const token = jwt.sign({ sub: 'x' }, 'wrong-secret');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('role middleware', () => {
  const run = (role, min) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireRole(min)({ user: { role } }, res, next);
    return { res, next };
  };
  it('blocks lower roles', () => {
    const { res, next } = run('author', 'editor');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('allows equal or higher roles', () => {
    expect(run('editor', 'editor').next).toHaveBeenCalled();
    expect(run('admin', 'editor').next).toHaveBeenCalled();
  });
});

describe('safe content and passwords', () => {
  it('strips HTML from content', () => {
    expect(plain('<script>alert(1)</script>Hello <b>you</b>')).toBe('Hello you');
  });
  it('hashes passwords and never exposes them in safe JSON', async () => {
    const user = new User({ name: 'T', email: 't@t.test', password: 'Password123!' });
    await user.validate();
    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(user.password, 4);
    expect(await user.comparePassword('Password123!')).toBe(true);
    expect(user.toSafeJSON().password).toBeUndefined();
  });
});
