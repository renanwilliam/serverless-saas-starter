import middy from '@middy/core';

export const removeDynamoDbFields: middy.MiddlewareObj = {
  after: (request) => {
    try {
      const response = JSON.parse(request.response.body);
      if (response?.PK) {
        delete response.PK;
      }
      if (response?.SK) {
        delete response.SK;
      }
      if (response?.data && Array.isArray(response.data)) {
        response.data.forEach((item) => {
          if (item?.PK) {
            delete item.PK;
          }
          if (item?.SK) {
            delete item.SK;
          }
        });
      }
      request.response.body = JSON.stringify(response);
    } catch (e) {}
  }
};
