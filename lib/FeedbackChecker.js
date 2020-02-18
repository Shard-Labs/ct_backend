const moment = require('moment');
const config = require('config');

module.exports = class FeedbackChecker {
  static isVisible(date) {
    const createdAt = moment(date);
    const visibleDate = moment().subtract(config.get('feedbackVisibleAfter'), 'days');
    return createdAt.isBefore(visibleDate);
  }
};
