import { APIGatewayProxyCognitoAuthorizer, APIGatewayProxyEventBase } from 'aws-lambda';
import { ModelFilter, ModelSorters } from '../models/abstractModel';

export const getFilterAndSortersFromEvent = (event: APIGatewayProxyEventBase<APIGatewayProxyCognitoAuthorizer>) => {
  const filters: ModelFilter[] = [];
  let sorters: ModelSorters = {};
  const { multiValueQueryStringParameters, queryStringParameters } = event;
  if (multiValueQueryStringParameters?.['filters[]']) {
    multiValueQueryStringParameters?.['filters[]']?.forEach((filterStr) => {
      const filter = JSON.parse(filterStr) as ModelFilter;
      filters.push(filter);
    });
  }
  if (queryStringParameters?.sorters) {
    sorters = JSON.parse(queryStringParameters.sorters);
  }
  return { filters, sorters };
};

export const calculateTimeToLive = (days: number) => {
  const SECONDS_IN_AN_HOUR = 60 * 60;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  return secondsSinceEpoch + days * 24 * SECONDS_IN_AN_HOUR;
};
