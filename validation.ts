import { Context, setResponse } from "./koa-helpers";
import { Validator } from "./validator";
import * as Koa from "koa";

export const validation =
  <T>(schema: Validator<T>) =>
  (ctx: Context, next: Koa.Next) => {
    const v = schema.validate(ctx.request.body);
    if (!v.isValid) {
      setResponse(ctx, 403, {
        errors: [
          {
            title: "Bad request",
            meta: {
              detail: v.error,
            },
          },
        ],
      });
      return;
    }

    ctx.request.body = v.value;
    next();
  };
