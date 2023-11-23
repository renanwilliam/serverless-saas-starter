import { IModelBasicInterface, ModelFilter, ModelSorters } from './abstractModel';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  paginateQuery,
  PutCommand,
  QueryCommandInput,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import Stripe from 'stripe';
import { calculateTimeToLive } from '../lib/utils';
import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-providers';

const APPLICATION_TABLE_NAME: string = process.env.APPLICATION_TABLE_NAME || '';
const FRONTEND_URL: string = process.env.FRONTEND_URL || 'http://localhost:300';
const STRIPE_KEY: string = process.env.STRIPE_API_KEY || '';
const STRIPE_PRICE_SINGLE_PURCHASE: string = process.env.STRIPE_PRICE_SINGLE_PURCHASE || '';

export type PurchaseType = {
  id: string;
  userId: string;
  anamnesis: Record<string, any>;
  status: 'PAID' | 'UNPAID' | 'CANCELLED';
  subscriptionId?: string;
  billingSystemId: string;
  billingSystemUrl?: string;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  ttl: number;
};

export class Purchase implements IModelBasicInterface<PurchaseType> {
  private readonly dbClient: DynamoDBClient;
  private readonly dbDocClient: DynamoDBDocumentClient;

  constructor(
    private userId: string,
    readonly credentials?: CognitoIdentityCredentialProvider
  ) {
    this.dbClient = new DynamoDBClient({
      credentials: this.credentials
    });
    this.dbDocClient = DynamoDBDocumentClient.from(this.dbClient);
  }

  async create(item: PurchaseType): Promise<PurchaseType> {
    const command = new PutCommand({
      TableName: APPLICATION_TABLE_NAME,
      Item: {
        PK: `${item.userId}`,
        SK: `PURCHASE#${item.id}`,
        ...item
      }
    });

    await this.dbDocClient.send(command);

    return item;
  }

  async createUsingStripe(item: PurchaseType, email?: string) {
    const stripe = new Stripe(STRIPE_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allow_promotion_codes: true,
      line_items: [
        {
          price: STRIPE_PRICE_SINGLE_PURCHASE,
          quantity: 1
        }
      ],
      success_url: `${FRONTEND_URL}/purchase-success`,
      cancel_url: '',
      client_reference_id: item.id,
      customer_email: email,
      metadata: {
        CUSTOMER_ID: item.userId
        //can be added any other meta property
      }
    });

    const createdItem = await this.create({
      ...item,
      status: 'UNPAID',
      billingSystemId: session.id,
      billingSystemUrl: session.url as string,
      ttl: calculateTimeToLive(1)
    });

    return {
      data: createdItem,
      stripeSession: session
    };
  }

  async delete(id: string): Promise<void> {
    const oldItem = await this.findOne(id);
    if (!oldItem) {
      throw new Error(`Purchase ${id} not found in database`);
    }

    const command = new DeleteCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${this.userId}`,
        SK: `PURCHASE#${id}`
      }
    });
    await this.dbDocClient.send(command);
  }

  async findOne(id: string): Promise<PurchaseType> {
    const command = new GetCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${this.userId}`,
        SK: `PURCHASE#${id}`
      }
    });

    const response = await this.dbDocClient.send(command);
    return response.Item as PurchaseType;
  }

  async queryAll(
    filters: ModelFilter[],
    sorter: ModelSorters | undefined,
    lastEvaluatedKey: string | undefined
  ): Promise<{
    data: PurchaseType[];
    lastEvaluatedKey?: any;
  }> {
    let queryCommandInput: QueryCommandInput = {
      TableName: APPLICATION_TABLE_NAME,
      KeyConditionExpression: '#primaryKey = :primaryKey AND begins_with(#sortKey, :prefix)',
      ExpressionAttributeNames: {
        '#primaryKey': `PK`,
        '#sortKey': `SK`
      },
      ExpressionAttributeValues: {
        ':primaryKey': `${this.userId}`,
        ':prefix': `PURCHASE#`
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
      data: response.value?.Items as unknown as PurchaseType[],
      lastEvaluatedKey: response.value?.LastEvaluatedKey
    };
  }

  async removeTimeToLive(id: string): Promise<void> {
    let currentRecord: PurchaseType;
    try {
      currentRecord = await this.findOne(id);
    } catch (e) {
      throw new Error(`Purchase ${id} not found in database`);
    }

    if (currentRecord.ttl) {
      const command = new UpdateCommand({
        TableName: APPLICATION_TABLE_NAME,
        Key: {
          PK: `${this.userId}`,
          SK: `PURCHASE#${id}`
        },
        UpdateExpression: `REMOVE #ttl`,
        ExpressionAttributeNames: {
          '#ttl': 'ttl'
        }
      });
      await this.dbDocClient.send(command);
    }
  }

  async update(id: string, newItem: Partial<PurchaseType>): Promise<PurchaseType> {
    try {
      await this.findOne(id);
    } catch (e) {
      throw new Error(`Purchase ${id} not found in database`);
    }

    const notUpdatableFields = ['PK', 'SK', 'createdAt', 'id', 'userId'];

    let updateExpression = 'set';
    let ExpressionAttributeNames = {};
    let ExpressionAttributeValues = {};
    for (const property in newItem) {
      if (newItem.hasOwnProperty(property) && notUpdatableFields.indexOf(property) < 0) {
        updateExpression += ` #${property} = :${property} ,`;
        ExpressionAttributeNames['#' + property] = property;
        ExpressionAttributeValues[':' + property] = newItem[property];
      }
    }

    updateExpression = updateExpression.slice(0, -1);

    const command = new UpdateCommand({
      TableName: APPLICATION_TABLE_NAME,
      Key: {
        PK: `${this.userId}`,
        SK: `PURCHASE#${id}`
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: ExpressionAttributeNames,
      ExpressionAttributeValues: ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const updateResult = await this.dbDocClient.send(command);
    return updateResult.Attributes as PurchaseType;
  }
}
