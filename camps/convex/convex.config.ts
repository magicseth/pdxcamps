import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
app.use(workflow);
app.use(stripe);
app.use(resend);

export default app;
