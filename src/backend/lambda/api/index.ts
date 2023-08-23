import { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from '@backend/lambda/api/server';
import { APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createOpenApiAwsLambdaHandler, generateOpenApiDocument } from 'trpc-openapi';
import { OpenAPIV3 } from 'openapi-types';
import { TRPCError } from '@trpc/server';
import assert from 'assert';
import { removeCloudFrontProxyPath, TRPCHandlerError } from '@backend/lambda/api/lib/utils/api_utils';
import { getEnv } from '@backend/lambda/api/environment';
import * as console from 'console';

/* Lazy loaded variables */
let openApiDocument: OpenAPIV3.Document | undefined;
function docsRoute(): APIGatewayProxyResult {
  const applicationName = 'Pets API';

  if (!openApiDocument) {
    openApiDocument = generateOpenApiDocument(appRouter, {
      title: applicationName,
      description: 'Pets API',
      version: '-',
      baseUrl: '-',
    });
  }

  const openApiDocumentJsonObject = JSON.stringify(openApiDocument);
  const body = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${applicationName}</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@3/swagger-ui.css">
            </head>
            <body>
                <div id="swagger"></div>
                <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
                <script>
                  SwaggerUIBundle({
                    dom_id: '#swagger',
                    spec: ${openApiDocumentJsonObject}
                });
                </script>
            </body>
            </html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body,
  };
}

export const handler = async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult> => {
  const ENVIRONMENT = getEnv();

  console.debug('EVENT', event);

  event = removeCloudFrontProxyPath(event, '/api-ingest');

  let response: APIGatewayProxyResult | undefined;
  let trpcLastError: TRPCHandlerError | undefined;
  try {
    /* Handle paths that return non JSON outside tRPC */
    if (event.rawPath === '/docs') {
      response = docsRoute();
    } else {
      /* Do any rewrites here if you wish before passing to tRPC */

      const trpcOpenApiHandler = createOpenApiAwsLambdaHandler({
        router: appRouter,
        createContext: ({ event }: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>) => {
          return {
            /* Add extra info to be used inside routes, add info about the user, do authentication and/or authorization here */
            request: {
              ip: event.headers['x-forwarded-for'] || '',
              ua: event.requestContext.http.userAgent,
            },
          };
        },
        onError(err) {
          trpcLastError = err;
        },
      });
      response = await trpcOpenApiHandler(event, context);
      response.headers = { ...response.headers };
    }
  } catch (err) {
    /* Should ideally never happen, the tRPC OpenAPI Lambda Handler will catch any `throw new Error(...)` and still
     * return a response that has status code 500. This is just to cover all the basis. */
    if (err instanceof Error) {
      console.error(err);
      if (!response) {
        response = {
          statusCode: 500,
          body: JSON.stringify(
            new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Unexpected Error Occurred',
              cause: ENVIRONMENT.ENVIRONMENT === 'dev' ? err : undefined,
            })
          ),
        };
      }
    } else {
      throw new Error('Error is unknown', { cause: err });
    }
  } finally {
    assert(response);
    /* Log original trpc error for easier debugging */
    if (trpcLastError) {
      console.error(trpcLastError);
    }
  }

  console.debug('RESPONSE', response);

  return response;
};
