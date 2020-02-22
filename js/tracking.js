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
   *     requestTokenEndpoint: 'https://learning.analytics/api/authentication/generate-token',
   *   },
   *   trackingAPI: 'https://learning.analytics/api/tracking',
   * },
   * consentBanner: {
   *   closeButton: {
   *     class: 'consent-banner--close',
   *     text: '&times;',
   *   },
   *   consentButton: {
   *     class: 'consent-banner--button',
   *     text: 'Okay!',
   *   },
   *   infoText: 'This presentation uses pseudonymous tracking for Learning Analytics.',
   *   moreLink: {
   *     class: 'consent-banner--more-link',
   *     href: 'https://learning.analytics/privacy',
   *     text: 'Learn more',
   *   },
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
   *   * audio-slideshow plug-in is helpful
   *   audio: true,
   *   video: true,
   * },
   * slideTransitions: true,
   * revealDependencies: {
   *   * requires quiz plug-in
   *   quiz: true,
   *   otherPluginInTheFuture: true,
   * },
   * timestamps: true,
   */
  var defaultConfig = {
    apiConfig: {},
    consentBanner: {
      closeButton: {
        class: 'consent-banner--close',
        text: '&times;',
      },
      consentButton: {
        class: 'consent-banner--button',
        text: 'Okay!',
      },
      infoText: 'This presentation uses pseudonymous tracking for Learning Analytics.',
      moreLink: {
        class: 'consent-banner--more-link',
        text: 'Learn more',
      },
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
  var slideTimer, globalTimer, quizTimer;
  var postBody = {};
  var consentGiven = false;
  var userToken;

  // Validate configuration for tracking plug-in
  if (config.apiConfig.trackingAPI == undefined) {
    console.error('You have no trackingAPI configured where to send tracking data to!');
    return;
  }

  if (
    config.apiConfig.authentication == undefined ||
    config.apiConfig.authentication.requestTokenEndpoint == undefined
  ) {
    console.warn(
      _strip(`
        You have no authenticationAPI configured.
        The tracking requests will not have tokens and the tracking data will be completely anonymous. 
        Please consider setting apiConfig.authentication.requestTokenEndpoint and
        apiConfig.authentication.validateTokenEndpoint.
      `)
    );
  } else if (
    config.apiConfig.authentication.requestTokenEndpoint != undefined &&
    config.apiConfig.authentication.validateTokenEndpoint == undefined
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

  // Main Logic: public functions
  function showConsentBanner() {
    if (userToken == undefined) {
      _loadStylesheet(document.currentScript.src + '/../../css/tracking.css');
      let cbConfig = config.consentBanner;

      let consentBanner = document.createElement('div');
      consentBanner.classList.add('consent-banner');
      consentBanner.innerHTML = _strip(`
        <span class="${cbConfig.closeButton.class}">${cbConfig.closeButton.text}</span>
        <p class="consent-banner--info-text">
          ${cbConfig.infoText}
          <a class="${cbConfig.moreLink.class}" href="${cbConfig.moreLink.href}" target="_blank">${cbConfig.moreLink.text}</a>
        </p>
        <button class="${cbConfig.consentButton.class}">${cbConfig.consentButton.text}</button>
      `);

      consentBanner.querySelector(`.${cbConfig.closeButton.class}`).addEventListener('click', function() {
        consentBanner.remove();
        consentGiven = false;
      });

      consentBanner.querySelector(`.${cbConfig.consentButton.class}`).addEventListener('click', function() {
        consentBanner.remove();
        consentGiven = true;
        _requestUserToken();
      });

      document.body.prepend(consentBanner);
    }
  }

  function addEventListeners() {
    _trackClosing();
    _trackDwellTimes();
    _trackLinks();
    _trackSlideTransitions();
    _trackMediaActions();
    _trackQuizzes();
  }

  // Consent Banner: helper functions
  function _loadStylesheet(path) {
    let link  = window.document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = path;

    window.document.getElementsByTagName('head')[0].appendChild(link);
  }

  // Main Logic: helper functions
  function _trackDwellTimes() {
    if (_tracksDwellTimePerSlide()) {
      Reveal.addEventListener('slidechanged', function(event) {
        _track('dwellTimePerSlide', {
          dwellTime: slideTimer.toString(),
        }, { timestamp: false });

        slideTimer.reset();
      });
    }
  }

  function _trackClosing() {
    window.addEventListener('pagehide', function() {
      if (_tracksDwellTimePerSlide()) {
        _track('dwellTimePerSlide', {
          dwellTime: globalTimer.toString(),
        }, { timestamp: false });
      }

      if (_tracksTotalDwellTime()) {
        _track('totalDwellTime', {
          dwellTime: globalTimer.toString(),
          finalProgress: Reveal.getProgress(),
        }, { timestamp: false });
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
            _track('internalLink', {
              link: event.target.href,
              linkText: event.target.text,
              target: {
                horizontalIndex: matches[1],
                verticalIndex: matches[2],
              },
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
            horizontalIndex: previousIndices.h,
            verticalIndex: previousIndices.v,
          },
          currentSlide: {
            slideNumber: Reveal.getSlidePastCount() + 1,
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

  function _trackMediaActions() {
    let tracksAudio = config.media === true || config.media.audio;
    let tracksVideo = config.media === true || config.media.video;

    if (tracksAudio || tracksVideo) {
      let mediaSelector = function(tracksAudio, tracksVideo) {
        if (tracksAudio && tracksVideo) {
          return 'audio, video';
        } else if(tracksAudio) {
          return 'audio';
        } else {
          return 'video';
        }
      }(tracksAudio, tracksVideo);

      document.querySelectorAll(mediaSelector).forEach(function(media) {
        let indicesRegex = media.id.match(/(audio|video)player\-(\d+)\.(\d+)(\.(\d+))?/);
        if (!indicesRegex) return true;

        let mediaType       = indicesRegex[1],
            horizontalIndex = parseInt(indicesRegex[2]),
            verticalIndex   = parseInt(indicesRegex[3]),
            mediaIndex      = parseInt(indicesRegex[5]) || 0;

        postBody.media = postBody.media || {};
        postBody.media[media.id] = {
          mediaType: mediaType,
          source: this.currentSrc,
          played: false,
          slideNumber: Reveal.getSlides().indexOf(Reveal.getSlide(horizontalIndex, verticalIndex)) + 1,
          horizontalIndex: horizontalIndex,
          verticalIndex: verticalIndex,
          mediaIndex: mediaIndex,
        };

        media.addEventListener('play', function () {
          _track(mediaType, {
            played: true,
          }, {
            id: this.id,
          });
        });

        media.addEventListener('pause', function () {
          _track(mediaType, {
            finished: this.ended,
            progress: this.currentTime / this.duration,
          }, {
            id: this.id,
          });
        });
      });
    }
  }

  function _trackQuizzes() {
    if (config.revealDependencies.quiz) {
      let quizNames = Array.from(document.querySelectorAll('[data-quiz]')).map(quizScript => quizScript.dataset.quiz);

      quizNames.forEach(function(quizName) {
        let quizConfig = window[quizName];
        if (!quizConfig) return true;

        let slide = document.querySelector(`[data-quiz="${quizName}"]`).parentElement;
        let slideIndices = Reveal.getIndices(slide);

        postBody.quizzes = postBody.quizzes || {};
        postBody.quizzes[quizName] = {
          quizName: quizConfig.info.name,
          quizTopic: quizConfig.info.main,
          numberOfQuestions: quizConfig.questions.length,
          started: false,
          completed: false,
          slideNumber: Reveal.getSlides().indexOf(slide) + 1,
          horizontalIndex: slideIndices.h,
          verticalIndex: slideIndices.v,
        };

        quizConfig.events = quizConfig.events || {};

        if (quizConfig.events.onStartQuiz) {
          let existingCallback = quizConfig.events.onStartQuiz;
          quizConfig.events.onStartQuiz = function() {
            quizTimer = new Timer();
            quizTimer.start();

            _track('quiz', { started: true }, { id: quizName });
            existingCallback();
          }
        }

        if (quizConfig.events.onCompleteQuiz) {
          let existingCallback = quizConfig.events.onCompleteQuiz;
          quizConfig.events.onCompleteQuiz = function(options) {
            let dwellTime = quizTimer.toString();
            quizTimer.clear();

            _track('quiz', {
              completed: true,
              score: options.score,
              dwellTime: dwellTime,
            }, { id: quizName });

            existingCallback(options);
          }
        }
      });
    }
  }

  // Helper methods.
  function _track(eventType, eventData, options = {}) {
    let event;
    if (['dwellTimePerSlide', 'internalLink', 'externalLink'].includes(eventType)) {
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

      case 'audio', 'video':
        postBody.media = postBody.media || {};
        postBody.media[options.id] = postBody.media[options.id] || {};
        postBody.media[options.id] = {
          ...postBody.media[options.id],
          ...eventData,
        }
        break;

      case 'quiz':
        postBody.quizzes = postBody.quizzes || {};
        postBody.quizzes[options.id] = postBody.quizzes[options.id] || {};
        postBody.quizzes[options.id] = {
          ...postBody.quizzes[options.id],
          ...eventData,
        }
        break;

      default:
        console.error(`the event ${eventType} does not exist. Thus, this data ${eventData} was lost.`);
        break;
    }
  }

  function _eventWithSlideMetadata(eventType, eventData, options = {}) {
    let slideIndices = Reveal.getIndices();
    let event = {
      type: eventType,
      eventData: {
        slideNumber: Reveal.getSlidePastCount() + 1,
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
   *   media: Object,
   *   quizzes: Object
   * }
   */
  function _sendData() {
    if (consentGiven) {
      if (userToken) {
        postBody.userToken = userToken;
      } else {
        console.warn('No user token is given.');
      }

      navigator.sendBeacon(config.api.apiConfig.trackingAPI, JSON.stringify(postBody));
    } else {
      console.warn('The user has not accepted to being tracked. No tracking data will be sent.');
    }
  }

  function _strip(string) {
    return string.trim().replace(/(\s)+/g, ' ').replace(/\n/g, '');
  }

  function _tracksTotalDwellTime() {
    return config.dwellTime === true || config.dwellTime.total;
  }

  function _tracksDwellTimePerSlide() {
    return config.dwellTime === true || config.dwellTime.perSlide;
  }

  // Return plug-in object
  return {
    init: function() {
      globalTimer = new Timer();
      slideTimer  = new Timer();
      globalTimer.start();
      slideTimer.start();

      addEventListeners();
      showConsentBanner();
    },
  }
})();

Reveal.registerPlugin('tracking', RevealTracking);
