import type { RequestHandler } from "express";

export type ApiRouteDefinition = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  handlers: RequestHandler[];
};
