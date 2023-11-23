import { CognitoIdentityCredentialProvider } from '@aws-sdk/credential-providers';

export type ModelFilter = {
  field: string;
  operator: '=' | '<>' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'contains' | 'between';
  low: any;
  high?: any;
};
type SortOrder = 'descend' | 'ascend' | null;
export type ModelSorters = {
  [fieldName: string]: SortOrder;
};

export interface IModelBasicInterface<T> {
  readonly credentials?: CognitoIdentityCredentialProvider;
  create: (item: T) => Promise<T>;
  update: (id: string, newItem: Partial<T>, userId: string) => Promise<T>;
  delete: (id: string, userId: string) => Promise<void>;
  findOne: (id: string, userId: string) => Promise<T>;
  queryAll: (
    filters: ModelFilter[],
    sorter?: ModelSorters | undefined,
    lastEvaluatedKey?: any | undefined
  ) => Promise<{
    data: T[];
    lastEvaluatedKey?: any;
  }>;
}
