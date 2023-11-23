import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import { removeDynamoDbFields } from './dynamodb';
import MiddlewareObject = middy.MiddlewareObj;

export default function commonMiddleware(
  handler,
  otherMiddlewares: Array<MiddlewareObject<any, any>> = []
): middy.MiddyfiedHandler<any, any> {
  return middy(handler).use([
    httpHeaderNormalizer({
      canonical: true
    }),
    httpEventNormalizer(),
    httpJsonBodyParser(),
    httpErrorHandler(),
    cors({
      origins: [`${process.env.FRONTEND_URL}`],
      credentials: true,
      headers: 'set-cookie'
    }),
    removeDynamoDbFields,
    ...otherMiddlewares
  ]);
}
