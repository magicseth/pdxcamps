import { defineApp } from 'convex/server';
import workflow from '@convex-dev/workflow/convex.config.js';
import stripe from '@convex-dev/stripe/convex.config.js';
import resend from '@convex-dev/resend/convex.config.js';
import aggregate from '@convex-dev/aggregate/convex.config.js';
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js';

const app = defineApp();
app.use(workflow);
app.use(stripe);
app.use(resend);
app.use(aggregate, { name: 'sessionsBySource' });
app.use(aggregate, { name: 'sessionsByCity' });
app.use(rateLimiter);

export default app;
