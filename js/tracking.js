/*!
 * reveal.js-tracking plugin v1.0.0
 * MIT licensed
 *
 * Copyright (C) 2020 Joe Pantazidis
 */

class Timer {
  constructor() {
    this.hours   = 0;
    this.minutes = 0;
    this.seconds = 0;
  }

  start() {
    let self = this;
    this.timer = setInterval(() => {
      self._incrementSecond();
    }, 1000);
  }

  reset() {
    this.clear();
    this.start();
  }

  clear() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.hours   = 0;
    this.minutes = 0;
    this.seconds = 0;
  }

  toString() {
    let hourString   = (this.hours   > 9 ? this.hours   : '0' + this.hours);
    let minuteString = (this.minutes > 9 ? this.minutes : '0' + this.minutes);
    let secondString = (this.seconds > 9 ? this.seconds : '0' + this.seconds);

    return (hourString + ':' + minuteString + ':' + secondString);
  }

  _incrementSecond() {
    this.seconds++;
    if (this.seconds >= 60) {
      this.seconds = 0;
      this.minutes++;
      if (this.minutes >= 60) {
        this.minutes = 0;
        this.hours++;
      }
    }
  }
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


  // Main Logic: helper functions
  function _trackDwellTimes() {
    if (_tracksDwellTimePerSlide()) {
      Reveal.addEventListener('slidechanged', function(event) {
        _track('dwellTimePerSlide', {
          dwellTime: slideTimer.toString(),
        });

        slideTimer.reset();
      });
    }
  }

  function _trackClosing() {
    window.addEventListener('pagehide', function() {
      if (_tracksDwellTimePerSlide()) {
        _track('dwellTimePerSlide', {
          dwellTime: globalTimer.toString(),
        });
      }

      if (_tracksTotalDwellTime()) {
        _track('totalDwellTime', {
          dwellTime: globalTimer.toString(),
          finalProgress: Reveal.getProgress(),
        });
      }

      _sendData();
    });
  }



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
