import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { router } from "./routes";
import { errorHandler, notFound } from "./middleware/error";
import { apiLimiter } from "./middleware/rateLimit";

const app = express();

// Render (and most hosting platforms) sit behind a reverse proxy — without
// this, every request looks like it comes from the proxy's IP, which would
// break the rate limiter below (it would see all users as "one IP").
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*", credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(morgan("dev"));

app.use("/api", apiLimiter, router);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API ready on http://localhost:${port}/api`));
