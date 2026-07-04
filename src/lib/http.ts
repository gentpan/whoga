export type RouteRequest = Request & {
  nextUrl: URL;
};

export function toRouteRequest(request: Request): RouteRequest {
  return Object.assign(request, { nextUrl: new URL(request.url) }) as RouteRequest;
}

export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}
