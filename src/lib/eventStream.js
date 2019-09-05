import { SNS } from 'aws-sdk';
import { parseJson } from './util';

const sns = new SNS({ apiVersion: '2010-03-31' });

const isString = val => typeof val === 'string';
const isNumber = val => typeof val === 'number';
const isArray = val => Array.isArray(val);

const getAttrType = val => {
  if (isString(val)) return 'String';
  if (isNumber(val)) return 'Number';
  if (isArray(val)) return 'String.Array';
  throw new Error(`Invalid MessageAttribute type: ${typeof val}. Valid types: String, Number, Array.`);
};

const parseAttributes = attributes => Object.keys(attributes)
  .reduce((res, key) => {
    const val = attributes[key];
    const type = getAttrType(val);
    return {
      ...res,
      [key]: {
        DataType: type,
        StringValue: type === 'String.Array' ? JSON.stringify(val) : val.toString(),
      },
    };
  }, {});

const isSnsString = type => type === 'String';
const parseSnsType = (val, type) => (isSnsString(type)
  ? val
  : JSON.parse(val));

/**
 * @typedef MessageAttribute
 * @property {string} DataType
 * @property {string} StringValue
 */

/**
 * @typedef CompanyEventAttributes
 * @property {MessageAttribute<string>} emitter
 * @property {MessageAttribute<string>} eventId
 * @property {MessageAttribute<string>} triggerEventId
 * @property {MessageAttribute<string>} entity
 * @property {MessageAttribute<string>} entityId
 * @property {MessageAttribute<'C' | 'R' | 'U' | 'D'>} operation
 * @property {MessageAttribute<'trigger' | 'pass' | 'fail'>} status
 */

export default {
  /**
   * @description Publish message to SNS event stream.
   * @param {string} topicArn
   * @param {{ [key: string]: any }} message
   * @param {CompanyEventAttributes} attributes
   */
  publish: async (topicArn, message, attributes = {}, options = {}) => {
    let res;
    try {
      const params = {
        Message: JSON.stringify(message),
        TopicArn: topicArn,
        MessageAttributes: parseAttributes(attributes),
        ...options,
      };
      res = await sns.publish(params).promise();
      console.log('SNS Publish - Success: ', JSON.stringify(params));
      return res;
    } catch (err) {
      console.log('SNS Publish - Failure: ', err.toString());
      return err;
    }
  },
  /**
   * @description Parses a CompanyEvent, returning an object that retains only the original event's "Message" and "MessageAttributes" values.
   * @template M
   * @param {{ Records: [{ Sns: { Message: M, MessageAttributes: { [key: string]: MessageAttribute } } }] }} event
   * @returns {{ message: M, attributes: { [key: string]: string | number | array } }}
   */
  parse: event => {
    const message = parseJson(event.Records[0].Sns.Message);
    const attributes = Object.keys(event.Records[0].Sns.MessageAttributes)
      .reduce((res, key) => {
        const {
          Type: type,
          Value: value,
        } = event.Records[0].Sns.MessageAttributes[key];

        const val = parseSnsType(value, type);
        return { ...res, [key]: val };
      }, {});
    return { message, attributes };
  },
};
