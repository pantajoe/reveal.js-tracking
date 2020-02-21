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

  function _trackLinks() {
    let tracksInternalLinks = config.links === true || config.links.internal;
    let tracksExternalLinks = config.links === true || config.links.external;

    if (tracksInternalLinks || tracksExternalLinks) {
      document.addEventListener('click', function(event) {
        if (!event.target.matches(`#${Reveal.getCurrentSlide().id} a`)) return true;

        let isInternalLink = event.target.href.startsWith('#');

        if (isInternalLink) {
          if (tracksInternalLinks) {
            let matches = event.target.href.match(/#\/(\d+)\/(\d+)/);
            _track('externalLink', {
              link: event.target.href,
              linkText: event.target.text,
              chapterLink: _getChapterNumber(matches[1], matches[2]),
            });
          }
        } else {
          if (tracksExternalLinks) {
            _track('externalLink', {
              link: event.target.href,
              linkText: event.target.text,
            });
          }
        }
      });
    }
  }




  function _trackSlideTransitions() {
    if (config.slideTransitions) {
      Reveal.addEventListener('slidechanged', function(event) {
        let previousIndices = Reveal.getIndices(event.previousSlide);
        let data = {
          previousSlide: {
            slideNumber: Reveal.getSlides().indexOf(event.previousSlide) + 1,
            chapter: _getChapterNumber(previousIndices.h, previousIndices.v),
            horizontalIndex: previousIndices.h,
            verticalIndex: previousIndices.v,
          },
          currentSlide: {
            slideNumber: Reveal.getSlidePastCount(),
            chapter: _getChapterNumber(event.indexh, event.indexv),
            horizontalIndex: event.indexh,
            verticalIndex: event.indexv,
          },
        };

        if (config.timestamps) {
          data.timestamp = globalTimer.toString();
        }

        _track('slideTransition', data);
      });
    }
  }

  // Helper methods.
  function _track(eventType, eventData, options = {}) {
    let event;
    if (eventType != 'totalDwellTime') {
      event = _eventWithSlideMetadata(eventType, eventData, options);
    }

    switch (eventType) {
      case 'dwellTimePerSlide':
        postBody.dwellTimes = postBody.dwellTimes || [];
        postBody.dwellTimes.push(event);
        break;

      case 'totalDwellTime':
        postBody = {
          ...postBody,
          ...eventData,
        }
        break;

      case 'internalLink', 'externalLink':
        postBody.links = postBody.links || [];
        postBody.links.push(event);
        break;

      case 'slideTransition':
        postBody.slideTransitions = postBody.slideTransitions || [];
        postBody.slideTransitions.push(eventData);
        break;
    }
  }

  function _eventWithSlideMetadata(eventType, eventData, options = {}) {
    let slideIndices = Reveal.getIndices();
    let event = {
      type: eventType,
      eventData: {
        slideNumber: Reveal.getSlidePastCount(),
        chapter: _getChapterNumber(slideIndices.h, slideIndices.v),
        horizontalIndex: slideIndices.h,
        verticalIndex: slideIndices.v,
        ...eventData,
      },
    };

    if (!options.timestamp && config.timestamps) {
      event.eventData.timestamp = globalTimer.toString();
    }

    return event;
  }

  /**
   * Transmits a JSON in this format:
   * 
   * {
   *   userToken: string
   *   totalNumberOfSlides: integer,
   *   progress: float,
   *   totalDwellTime: string,
   *   dwellTimes: Array
   *   slideTransitions: Array,
   *   links: Array,
   *   media: Array,
   *   quizzes: Array
   * }
   */
  function _sendData() {
    // TODO: only send if consent given, otherwise display warn message to console.
    // TODO: use navigator.sendBeacon
    // TODO: 3 retries if possible
  }

  function _strip(string) {
    return string.trim().replace(/(\s)+/g, ' ').replace(/\n/g, '');
  }

  function _getChapterNumber(indexh, indexv) {
    if (indexv > 0) {
      return `${indexh - 1}`;
    } else {
      return `${indexh - 1}.${indexv - 1}`;
    }
  }

  function _tracksTotalDwellTime() {
    return config.dwellTime === true || config.dwellTime.total;
  }

  function _tracksDwellTimePerSlide() {
    return config.dwellTime === true || config.dwellTime.perSlide;
  }

  // Return plug-in object
  return {
    init: function () {
      Timer.start();
    },
  }
})();

Reveal.registerPlugin('tracking', RevealTracking);
