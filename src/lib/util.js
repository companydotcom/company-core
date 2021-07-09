import { SSM } from 'aws-sdk';
import db from './dynamo';

/**
 * @description Attempt to JSON.parse input value. If parse fails, return original value.
 * @param {any} v
 * @returns {any}
 */
export const parseJson = v => {
  try {
    return JSON.parse(v);
  } catch (err) {
    return v;
  }
};

const getCodeStatus = code => {
  switch (code) {
    case 200:
      return 'OK';
    case 201:
      return 'Created';
    case 400:
      return 'Bad Request';
    case 500:
      return 'Internal Server Error';
    default:
      return undefined;
  }
};

/**
 * @typedef {Object} LambdaProxyIntegrationResponse
 * @property {number} statusCode
 * @property {string} body
 */

/**
 * @description Format HTTP lambda's input, result, and response code to be compliant with Lambda proxy integration
 * @param {number} code
 * @param {*} input
 * @param {*} result
 * @returns {LambdaProxyIntegrationResponse}
 */
export const formatHttpResponse = (code, input, result) => {
  const status = getCodeStatus(code);
  const resp = `HTTP Resp: ${code}${status ? ` - ${status}` : ''}`;
  return {
    statusCode: code,
    body: JSON.stringify({
      resp,
      input,
      result
    })
  };
};

const processParams = ({ Parameters: params }) => params.reduce((result, param) => {
  const { Name: name, Value: value } = param;
  return { ...result, [name]: value };
}, {});

/**
 * @description Get AWS Parameter Store parameters in an object, formatted such that keys correspond to parameter names and values to parameter values
 * @param {string} region
 * @param {string[]} paramNames
 * @template T
 * @returns {{}}
 */
export const getEnvParams = async (region, paramNames) => {
  const ssm = new SSM({ apiVersion: '2014-11-06', region });

  const options = {
    Names: paramNames,
    WithDecryption: true,
  };

  const params = await ssm.getParameters(options).promise();
  return processParams(params);
};

/**
 * Classis sleep function using async-await
 * @param {Number} s is the number of milliseconds to sleep
 */
 export const sleep = async s => new Promise(r => setTimeout(() => { r(); }, s));

 /**
  * Checks if the given param exists in the given object
  * @param {object} obj is the object to check if the given param exists in
  * @param {string} param is the param to check if it exists in the given obj
  * @returns {Boolean}
  */
 // eslint-disable-next-line max-len
 export const itemExists = (obj, param) => typeof obj === 'object' && obj !== null ? Object.prototype.hasOwnProperty.call(
   obj, param,
 ) : false;

/**
 * @description Creates or updates a VendorIdUserIdMap record for a given userId/serviceName combination
 * @param {string} userId - canonical userId
 * @param {string} serviceName - the name of the relevant service, should be found in the .env of skynet services
 * @param {string} vendorId - unique identifier created by a vendor/service associated with a platform user
 */
export const setUserVendorIdMap = async (userId, serviceName, vendorId) => {
  if (!userId || !serviceName || !vendorId) {
    console.log('UserId, Vendor/ServiceName and the user\'s id with the vendor all all required');
    throw new Error('Cannot create vendor Id map without all required data')
  }
  await batchPutIntoDynamoDb([{
    userIdService: `${userId}-${serviceName}`,
    vendorIdService: `${vendorId}-${serviceName}`
  }], 'VendorIdUserIdMap');
};

/**
 * @param {string} userId
 * @returns User object as stored in dynamo
 */
export const getUser = async userId => {
  const matched = await db.fetchRecordsByQuery({
  TableName: 'User',
  KeyConditionExpression: 'userId = :uid',
  ExpressionAttributeValues: {
    ':uid': {
      S: userId
    }
  }
});
  return matched.length ? matched[0] : undefined;
}

/**
 * @description Given a VendorIdUserIdMap record has been created - determines the platform User for a specified vendorId & service
 * @param {string} serviceName - official service name should be present in .env of skynet services
 * @param {string} vendorId - the unique id for a user/account used by the vendor/service
 * @param {boolean} hydrateUser - whether to return the populated user object
 * @returns { userId: '', ...user } - ...user will only be populated if hydrateUser is supplied as "true".  If no record is found for the vendorId/serviceName combination, null is returned
*/
export const getUserIdByVendorId = async (serviceName, vendorId, hydrateUser = true) => {
  if (!vendorId || !serviceName) {
    console.log('Vendor/service name and userId are both required');
    throw new Error('Cannot fetch userId without vendorId and service name');
  }
  const records = await db.fetchRecordsByQuery({
    TableName: 'VendorIdUserIdMap',
    IndexName: 'vendorIdService-index',
    KeyConditionExpression: 'vendorIdService = :vid',
    ExpressionAttributeValues: {
      ':vid': {
        S: `${vendorId}-${serviceName}`,
      },
    },
  });
  if (records && records.length) {
    const userId = records[0].userIdService.split(`-${serviceName}`)[0];
    if (hydrateUser && userId) {
      return getUser(userId);
    }
    return { userId };
  }
  return null;
};
