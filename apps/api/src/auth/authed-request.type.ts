import type { Request } from "express";

export type AuthedRequest = Request & {
  user?: any; // depois você tipa com JwtPayload se quiser
};
