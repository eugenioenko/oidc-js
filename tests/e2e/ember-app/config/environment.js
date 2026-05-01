'use strict';

module.exports = function (environment) {
  const ENV = {
    modulePrefix: 'e2e-ember-app',
    environment,
    rootURL: '/',
    locationType: 'history',
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {},
    },
    APP: {},
  };

  return ENV;
};
