import { SQSEvent, SQSHandler } from 'aws-lambda';

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('new purchase async processing');
  console.log('event', JSON.stringify(event, null, 2));
};
