import { withEventStream } from './lib/helper';
import es from './lib/eventStream'
import * as utils from './lib/util';

/**
 * @description An object that exposes
 * @exports
 * @module eventStream
 * @module utils
 */
module.exports = {
  /**
   * @description Event stream libs
   */
  eventStream: { ...es, withEventStream },
  /**
   * @description Utility functions
   */
  utils,
  health: svcName => {
    return `${svcName} is healthy`;
  }
};
