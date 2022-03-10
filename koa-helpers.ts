import * as Koa from "koa";
import * as Router from "@koa/router";
import { Statuses } from "./http";
import { IValidationError } from "./validator";

export type Context = Koa.ParameterizedContext<
  Koa.DefaultState,
  Koa.DefaultContext &
    Router.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
  any
>;

type Link = string | { href: string; meta: string };

type JSONError = {
  id?: string;
  title?: string;
  links?: {
    about: Link;
  };
  status?: string;
  code?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: {};
};

type NonNull = string | number | boolean | object | unknown[];

type JSONObject = { data: NonNull };
type JSONErrors = { errors: JSONError[] };
type JSONMeta = { meta: NonNull };

type JSONSchema = JSONObject | JSONErrors | JSONMeta;

export function setResponse(
  ctx: Context,
  status: Statuses,
  responseObject: JSONSchema
) {
  ctx.status = status;
  ctx.body = responseObject;
}

export function sendValidationError(
  ctx: Context,
  validationError: IValidationError
) {
  ctx.status = 403;
  ctx.body = {
    errors: [
      {
        title: "Bad request body",
        meta: {
          detail: validationError,
        },
      },
    ],
  };
}
