import { loadEnvFileIfPresent } from '../src/config';

// Lets you keep TEST_DATABASE_URL in your .env file instead of typing it every time.
loadEnvFileIfPresent();
