import uuid from 'uuid/v4';
import es from './eventStream';

export const withEventStream = async (snsTopicARN, eventHandler, event) => {
  console.log('event: ', JSON.stringify(event));

  let attributes;
  let message;

  try {
    ({ message, attributes } = es.parse(event));
    console.log('message: ', JSON.stringify(message));
    console.log('attributes: ', JSON.stringify(attributes));

    const payload = await eventHandler({ message, attributes });
    console.log('result: ', JSON.stringify(payload));

    return es.publish(
      snsTopicARN,
      {
        context: message.context,
        metadata: message.metadata,
        payload,
      },
      {
        emitter: 'tile-event-service',
        eventId: uuid(),
        triggerEventId: attributes.eventId,
        entity: attributes.entity,
        entityId: attributes.entityId,
        operation: attributes.operation,
        metadata: message.metadata.eventType,
        status: 'pass',
      },
    );
  } catch (err) {
    console.error('ERROR: ', err);

    return es.publish(
      snsTopicARN,
      {
        context: message.context,
        metadata: message.metadata,
        payload: {
          error: JSON.stringify(err, Object.getOwnPropertyNames(err)),
        },
      },
      {
        emitter: 'tile-event-service',
        eventId: uuid(),
        triggerEventId: attributes.eventId,
        entity: attributes.entity,
        entityId: attributes.entityId,
        operation: attributes.operation,
        metadata: message.metadata.eventType,
        status: 'fail',
      },
    );
  }
};
