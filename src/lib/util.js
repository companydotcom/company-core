import { SSM } from 'aws-sdk';

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
 * @description Format HTTP lambda's input, result, and response code to be comliant with Lambda proxy integration
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

module.exports = getEnvParams;
