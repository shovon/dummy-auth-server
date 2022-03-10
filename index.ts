import * as Koa from "koa";
import * as http from "http";
import * as Router from "@koa/router";
import * as cors from "@koa/cors";
import * as bodyParser from "koa-bodyparser";
import * as crypto from "crypto";
import {
  object,
  predicate,
  replaceError,
  Validator,
  string,
  chain,
  InferType,
} from "./validator";
import { validation } from "./validation";
import { Context, setResponse } from "./koa-helpers";

const app = new Koa();
const publicRoutes = new Router();
const privateRoutes = new Router();

type User = { email: string; name?: string };

const users = new Map<string, User>();
const auths = new Map<string, string>();

const SESSION_TOKEN = "session_token";

function unauthorized(ctx: Context) {
  ctx.cookies.set(SESSION_TOKEN);
  setResponse(ctx, 403, { errors: [{ title: "Unauthorized" }] });
}

privateRoutes.use(async (ctx, next) => {
  const token = ctx.cookies.get(SESSION_TOKEN);

  if (!token) {
    // TODO: log this
    return unauthorized(ctx);
  }
  const authEmail = auths.get(token);

  if (!authEmail) {
    // TODO: log this
    return unauthorized(ctx);
  }

  if (!users.has(authEmail)) {
    return unauthorized(ctx);
  }

  await next();
});

function generateSessionToken() {
  return crypto.randomBytes(24).toString("base64");
}

const emailRegex =
  /^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const regex = <T extends string>(v: Validator<T>, regex: RegExp) =>
  predicate(v, (value) => regex.test(value));

const email = () =>
  chain(
    string(),
    replaceError(regex(string(), emailRegex), (value) => ({
      type: "Bad email",
      errorMessage:
        "The supplied email address is a bad email address, or not an email address at all",
      value,
    }))
  );

const loginSchema = object({
  email: email(),
});

publicRoutes.post("/login", validation(loginSchema), (ctx) => {
  const { email } = ctx.body as InferType<typeof loginSchema>;

  const token = generateSessionToken();

  ctx.cookies.set(SESSION_TOKEN, token);

  if (!users.has(email)) {
    users.set(email, { email });
  }

  auths.set(token, email);

  setResponse(ctx, 200, { data: { email } });
});

function sessionFailure(ctx: Context) {
  // TODO: log this.
  setResponse(ctx, 500, {
    errors: [
      {
        title: "Session failure",
        detail:
          "The cookie has been successfully verified, but suddenly became invalid, internally",
      },
    ],
  });
}

publicRoutes.get("/logout", (ctx) => {
  const token = ctx.cookies.get(SESSION_TOKEN);
  if (!token) {
    return sessionFailure(ctx);
  }
  auths.delete(token);
  ctx.cookies.set(SESSION_TOKEN);

  setResponse(ctx, 200, { meta: { message: "Successfully logged out" } });
});

privateRoutes.get("/account", (ctx) => {
  const token = ctx.cookies.get(SESSION_TOKEN);
  if (!token) {
    return sessionFailure(ctx);
  }
  const emailAddress = auths.get(token);
  if (!emailAddress) {
    return sessionFailure(ctx);
  }
  const account = users.get(emailAddress);
  if (!account) {
    return sessionFailure(ctx);
  }

  setResponse(ctx, 200, {
    data: account,
  });
});

app.use(
  cors({
    credentials: true,
    allowHeaders: "Content-Type, User-Agent, X-HTTP-Method-Override".split(
      ", "
    ),
    allowMethods: "GET, POST, DELETE, PUT, OPTION, UPGRADE, AUTHPOKE".split(
      ", "
    ),
    origin: process.env.CORS_ORIGIN,
  })
);

app.use(bodyParser());
app.use(publicRoutes.routes());
app.use(privateRoutes.routes());

app.listen(8080, function (this: http.Server) {
  console.log(this.address());
});
