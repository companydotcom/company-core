import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB({ apiVersion: '2012-08-10' })
const docClient = new DynamoDB.DocumentClient()

// Safety limit for bulk insertions into DynamoDb
const batchWriteRecordsLimit = 25;

// Fallback safety limit for bulk queries from DynamoDb
const dynamoDbQuerySafeBatchLimit = 1000;

/**
 * Classis sleep function using async-await
 * @param {Number} s is the number of milliseconds to sleep
 */
const sleep = async s => new Promise(r => setTimeout(() => { r(); }, s));

/**
* Checks if the given param exists in the given object
* @param {object} obj is the object to check if the given param exists in
* @param {string} param is the param to check if it exists in the given obj
* @returns {Boolean}
*/
// eslint-disable-next-line max-len
const itemExists = (obj, param) => typeof obj === 'object' && obj !== null ? Object.prototype.hasOwnProperty.call(
  obj, param,
) : false;

/**
   * Gets records for given query object.
   * If there is no limit set on the number of records, it uses the built-in safety limit.
   * All records returned are simple Javascript Objects with Key-Value pairs (doing away with
   * DynamoDb style of defining values for properties along with data type - unmarshalling)
   * @param {Object} queryObject
   * @returns {[{String: *}]}
   */
const fetchRecordsByQuery = async ( queryObject,
  paginate = false) => {
  // Add safe fetch limit if one is not set
  if (!itemExists(queryObject, 'Limit')) {
    // eslint-disable-next-line no-param-reassign
    queryObject.Limit = dynamoDbQuerySafeBatchLimit;
  }
  try {
    const qResult = await dynamodb.query(queryObject).promise();
    if (paginate === true) {
      if (!itemExists(qResult, 'Items') || qResult.Items.length < 1) {
        return { items: [], ExclusiveStartKey: undefined };
      }
      return {
        items: qResult.Items.map(it => DynamoDB.Converter.unmarshall(it)),
        ExclusiveStartKey: itemExists(qResult, 'LastEvaluatedKey')
          ? qResult.LastEvaluatedKey : undefined,
      };
    }
    if (!itemExists(qResult, 'Items') || qResult.Items.length < 1) {
      return [];
    }
    // Convert DynamoDb stlye objects to simple Javascript objects
    return qResult.Items.map(item => DynamoDB.Converter.unmarshall(item));
  } catch (err) {
    throw err;
  }
};

/**
 * Increment the value in the given column by the given value
 * @param {String} tName is the table name
 * @param {Object} srchParams are the search params for the record
 * @param {String} colName column name to increment
 * @param {Number} incVal value to increment by
 * @returns {Boolean}
 */
// eslint-disable-next-line arrow-body-style
const incrementColumn = async (tName, srchParams,
  colName, incVal) => {
  const obj = {
    TableName: tName,
    Key: srchParams,
    UpdateExpression: `ADD ${colName} :val`,
    ExpressionAttributeValues: {
      ':val': incVal,
    },
  };
  return docClient.update(obj).promise();
};

/**
   * Inserts/ Upserts data into DynamoDb with given records to the given table
   * @param {Array} records
   * @param {String} tName
   * @returns {Boolean}
   */
const batchPutIntoDynamoDb = async (recs, tName,
  backoff = 1000) => {
  // Convert all records to DynamoDb object structure and append the top level
  // object structure for each record insertion
  const preparedRecords = recs.map(record => ({
    PutRequest:
      { Item: DynamoDB.Converter.marshall(record) },
  }));

  const bulkRequests = [];

  // Split the records into batches of the safe batch request length, insert
  // the top level object for insertion and send the split batches for batch
  // write into database all at the same time using Promise.all
  while (preparedRecords.length > 0) {
    bulkRequests.push(dynamodb.batchWriteItem(
      {
        RequestItems: {
          [tName]: preparedRecords.splice(0, batchWriteRecordsLimit),
        },
      },
    ).promise());
  }

  console.log(`DYNAMODB SERVICE: batchPutIntoDynamoDb: totalBulkRequestsSent: ${bulkRequests.length} with each request having ${batchWriteRecordsLimit} records except the last one having ${recs.length - (batchWriteRecordsLimit * (bulkRequests.length - 1))} records`);

  try {
    const result = await Promise.all(bulkRequests);
    const unprocessedRecords = (result.map(resultDatum => {
      if (itemExists(resultDatum, 'UnprocessedItems')
        && itemExists(resultDatum.UnprocessedItems, tName)
        && resultDatum.UnprocessedItems[tName].length > 0) {
        // eslint-disable-next-line max-len
        return resultDatum.UnprocessedItems[tName].map(
          unprocessedRec => DynamoDB.Converter.unmarshall(
            unprocessedRec.PutRequest.Item,
          ),
        );
      }
      return [];
    })).reduce((output, currentArray) => output.concat(currentArray));
    if (unprocessedRecords.length > 0) {
      await sleep(backoff);
      return batchPutIntoDynamoDb(unprocessedRecords, tName,
        backoff + 1000);
    }
    return true;
  } catch (err) {
    throw err;
  }
};

/**
   * Gets records for given query object.
   * If there is no limit set on the number of records, it uses the built-in safety limit.
   * All records returned are simple Javascript Objects with Key-Value pairs (doing away with
   * DynamoDb style of defining values for properties along with data type - unmarshalling)
   * @param {Object} scanConfig
   * @returns {[{String: *}]}
   */
const performTableScan = async (scanConfig,
  paginate = false) => {
  // Add safe fetch limit if one is not set
  if (!itemExists(scanConfig, 'Limit')) {
    // eslint-disable-next-line no-param-reassign
    scanConfig.Limit = dynamoDbQuerySafeBatchLimit;
  }
  try {
    const qResult = await dynamodb.scan(scanConfig).promise();
    if (paginate === true) {
      if (!itemExists(qResult, 'Items') || qResult.Items.length < 1) {
        return { items: [], ExclusiveStartKey: undefined };
      }
      return {
        items: qResult.Items.map(it => DynamoDB.Converter.unmarshall(it)),
        ExclusiveStartKey: itemExists(qResult, 'LastEvaluatedKey')
          ? qResult.LastEvaluatedKey : undefined,
      };
    }
    if (!itemExists(qResult, 'Items') || qResult.Items.length < 1) {
      return [];
    }
    // Convert DynamoDb stlye objects to simple Javascript objects
    return qResult.Items.map(item => DynamoDB.Converter.unmarshall(item));
  } catch (err) {
    throw err;
  }
};

export default {
  fetchRecordsByQuery,
  incrementColumn,
  batchPutIntoDynamoDb,
  performTableScan,
}
