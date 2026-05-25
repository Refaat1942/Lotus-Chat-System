import 'dotenv/config';

const env = (globalThis as any).process?.env;
if (!env?.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

/** @type {import('drizzle-kit').Config} */
const config = {
  schema: './src/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
};

export default config;
