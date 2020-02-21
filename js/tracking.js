/*!
 * reveal.js-tracking plugin v1.0.0
 * MIT licensed
 *
 * Copyright (C) 2020 Joe Pantazidis
 */

var seconds = 0, minutes = 0, hours = 0;
var Timer = {
  start: function () {
    var timer = this;
    setInterval(() => {
      timer.incrementSecond();
    }, 1000);
  },
  incrementSecond: function () {
    seconds++;
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
      if (minutes >= 60) {
        minutes = 0;
        hours++;
      }
    }
  },
  toString: function () {
    var hourString   = (hours   ? (hours > 9   ? hours   : '0' + hours)   : '00');
    var minuteString = (minutes ? (minutes > 9 ? minutes : '0' + minutes) : '00');
    var secondString = (seconds > 9 ? seconds : '0' + seconds);

    return (hourString + ':' + minuteString + ':' + secondString);
  },
};

var RevealTracking = window.RevealTracking || (function () {
  /**
   * apiConfig: {
   *   authenticationAPI: {
   *     validateTokenEndpoint: 'https://learning.analytics/api/authentication/validate-token',
   *     generateTokenEndpoint: 'https://learning.analytics/api/authentication/generate-token',
   *   },
   *   trackingAPI: 'https://learning.analytics/api/tracking',
   * },
   * consentBanner: {
   *   close: '&times;',
   *   consentButton: 'Okay!',
   *   description: 'This presentation uses pseudonymous tracking for Learning Analytics. For more information click <a href="%link%">here</a>'
   *   link: 'https://learning.analytics/privacy',
   * },
   * dwellTime: {
   *   total: true,
   *   perSlide: true,
   * },
   * links: {
   *   internal: true,
   *   external: true,
   * },
   * media: {
   *   audio: true,
   *   video: true,
   * },
   * slideTransitions: true,
   * revealDependencies: {
   *   quiz: true,
   *   otherPluginInTheFuture: true,
   * },
   * timestamps: true,
   */
  var defaultConfig = {
    apiConfig: {},
    consentBanner: {
      close: '&times;',
      consentButton: 'Okay!',
      description: 'This presentation uses pseudonymous tracking for Learning Analytics. For more information click <a href="%link%">here</a>', 
    },
    dwellTime: true,
    links: true,
    media: true,
    slideTransitions: true,
    timestamps: true,
    revealDependencies: {
      quiz: false,
    },
  };

  var config = {...defaultConfig, ...Reveal.getConfig().tracking};

  // Validate configuration for tracking plug-in
  if (config.apiConfig.trackingAPI === undefined) {
    console.error('You have no trackingAPI configured where to send tracking data to!');
    return;
  }

  if (
    config.apiConfig.authentication === undefined ||
    config.apiConfig.authentication.generateTokenEndpoint === undefined
  ) {
    console.warn(
      _strip(`
        You have no authenticationAPI configured.
        The tracking requests will not have tokens and the tracking data will be completely anonymous. 
        Please consider setting apiConfig.authentication.generateTokenEndpoint and
        apiConfig.authentication.validateTokenEndpoint.
      `)
    );
  } else if (
    config.apiConfig.authentication.generateTokenEndpoint !== undefined &&
    config.apiConfig.authentication.validateTokenEndpoint === undefined
  ) {
    console.warn(
      _strip(`
        You have no validateTokenEndpoint configured in the authenticationAPI.
        Tokens will not be validated prior to the transmission of tracking data.
        You might lose data!
        Please consider setting apiConfig.authentication.validateTokenEndpoint.
      `)
    );
  }

  // Main Logic


  // Helper methods.
  function _strip(string) {
    return string.trim().replace(/(\s)+/g, ' ').replace(/\n/g, '');
  }

  // Return plug-in object
  return {
    init: function () {
      Timer.start();
    },
  }
})();

Reveal.registerPlugin('tracking', RevealTracking);
