import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateQuery,
  PutCommand,
  QueryCommandInput
} from '@aws-sdk/lib-dynamodb';
import { Cognito } from '../lib/cognito';
import { DateTime } from 'luxon';
import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-providers';

const APPLICATION_TABLE_NAME: string = process.env.APPLICATION_TABLE_NAME || '';

export type UserType = {
  id: string;
  email: string;
  name: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
};

export type UserStatsType = {
  updatedAt: string;
};

export type WebsocketConnection = {
  PK: string;
  SK: string;
  connectionId: string;
  domainName: string;
  createdAt: string;
  ttl: number;
};

export class User {
  private dbClient: DynamoDBClient;
  private dbDocClient: DynamoDBDocumentClient;

  constructor(readonly credentials?: CognitoIdentityCredentialProvider) {
    this.dbClient = new DynamoDBClient({
      credentials: this.credentials
    });
    this.dbDocClient = DynamoDBDocumentClient.from(this.dbClient);
  }

  async create(item: UserType): Promise<UserType> {
    const cognito = new Cognito();

    const cognitoUser = await cognito.createUser(item);
    item.id = cognitoUser?.Attributes?.find((value) => value.Name === 'sub')?.Value as string;

    return item;
  }

  async createInitialStats(userId: string) {
    const command = new PutCommand({
      TableName: APPLICATION_TABLE_NAME,
      Item: {
        PK: `${userId}`,
        SK: `#STATS#`,
        updatedAt: DateTime.now().toString()
      }
    });
    return this.dbDocClient.send(command);
  }

  async getStats(userId: string) {
    const command = new GetCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${userId}`,
        SK: `#STATS#`
      }
    });

    let response = await this.dbDocClient.send(command);
    if (!response.Item) {
      response = await this.createInitialStats(userId);
    }
    return response.Item as UserStatsType;
  }

  async saveWebsocketConnection(userId: string, connectionId: string, domainName: string) {
    const command = new PutCommand({
      TableName: APPLICATION_TABLE_NAME,
      Item: {
        PK: `${userId}`,
        SK: `WSCONNECTION#${connectionId}`,
        connectionId,
        domainName,
        createdAt: DateTime.now().toString(),
        ttl: new Date().getTime() / 1000 + 3600
      }
    });
    return this.dbDocClient.send(command);
  }

  async getWebsocketConnections(userId: string, lastEvaluatedKey: string | undefined) {
    const queryCommandInput: QueryCommandInput = {
      TableName: APPLICATION_TABLE_NAME,
      KeyConditionExpression: '#primaryKey = :primaryKey AND begins_with(#sortKey, :prefix)',
      ExpressionAttributeNames: {
        '#primaryKey': `PK`,
        '#sortKey': `SK`
      },
      ExpressionAttributeValues: {
        ':primaryKey': `${userId}`,
        ':prefix': `WSCONNECTION#`
      }
    };

    const paginator = paginateQuery(
      {
        client: this.dbDocClient,
        startingToken: lastEvaluatedKey ? JSON.parse(lastEvaluatedKey) : undefined
      },
      queryCommandInput
    );

    const response = await paginator.next();

    return {
      data: response.value?.Items as WebsocketConnection[],
      lastEvaluatedKey: response.value?.LastEvaluatedKey
    };
  }

  async deleteWebsocketConnection(userId: string, connectionId: string) {
    const getCommand = new GetCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${userId}`,
        SK: `WSCONNECTION#${connectionId}`
      }
    });

    let response = await this.dbDocClient.send(getCommand);
    if (!response.Item) {
      throw new Error(`Websocket connection ${connectionId} not found in database`);
    }

    const command = new DeleteCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${userId}`,
        SK: `WSCONNECTION#${connectionId}`
      }
    });

    await this.dbDocClient.send(command);
  }
}
