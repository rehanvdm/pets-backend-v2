import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { TRPCError } from '@trpc/server';

export type TRPCHandlerError = {
  error: TRPCError;
  type: 'mutation' | 'query' | 'subscription' | 'unknown';
  path: string | undefined;
  req: APIGatewayProxyEventV2;
  input: unknown;
  ctx: object | undefined;
};

// USAGE: event = removeCloudFrontProxyPath(event, '/api');
// export function removeCloudFrontProxyPath(event: APIGatewayProxyEventV2, path: string) {
//   if (event.rawPath.startsWith(path)) {
//     event.rawPath = event.rawPath.replace(path, '');
//     event.requestContext.http.path = event.requestContext.http.path.replace(path, '');
//   }
//
//   return event;
// }

/* For manual CORS within the Lambda, not used in this example */
// export function validateAndGetCorsOrigin(origin: string, allowedOrigins: string[]) {
//   if (allowedOrigins.includes('*')) {
//     return origin;
//   }
//
//   if (allowedOrigins.includes(origin)) {
//     return origin;
//   } else {
//     return false;
//   }
// }
// export function corsHeaders(origin: string) {
//   return {
//     'Access-Control-Allow-Origin': origin,
//     'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
//     'Access-Control-Allow-Headers': '*',
//     'Access-Control-Max-Age': '86400',
//   };
// }
// export function handleCors(event: APIGatewayProxyEventV2, allowedOrigins: string[]): {
//   response: APIGatewayProxyResult | undefined;
//   headers: { [key: string]: string } | undefined;
// } {
//   const corsValidOrigin = validateAndGetCorsOrigin(event.headers.origin || '', allowedOrigins);
//
//   if (!corsValidOrigin) {
//     console.error('Invalid origin:', event.headers.origin);
//     return {
//       response: { statusCode: 403, body: '' },
//       headers: undefined
//     };
//   } else {
//     const returnCorsHeaders = corsHeaders(corsValidOrigin);
//     if (event.requestContext.http.method === 'OPTIONS') {
//       return {
//         response: { statusCode: 200, headers: returnCorsHeaders, body: '' },
//         headers: returnCorsHeaders
//       };
//     } else {
//       return {
//         response: undefined,
//         headers: returnCorsHeaders
//       };
//     }
//   }
// }
// Then Just make the first if:
// ```
//    const cors = handleCors(event, ENVIRONMENT.ALLOWED_ORIGINS);
//     if (cors.response) {
//       response = cors.response;
//     }
//     if else (event.rawPath === '/docs') {
//     ...
//
//     response.headers = { ...response.headers, ...cors.headers };
// ```
