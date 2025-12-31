import { buildApp } from "./app.js";

const host = process.env.CPMS_API_HOST ?? "0.0.0.0";
const port = Number(process.env.CPMS_API_PORT ?? "8787");

const app = await buildApp({ logger: true });
app.listen({ host, port });
