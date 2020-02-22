/*!
 * reveal.js-tracking plugin v1.0.0
 * MIT licensed
 *
 * Copyright (C) 2020 Joe Pantazidis
 */

/**
 * A basic Timer class to capture dwell times.
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

/**
 * Tracking plug-in for reveal.js
 */
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
   *     text: 'I\'d like that!',
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
   * timeline: true,
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
        text: 'I\'d like that!',
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
    timeline: true,
    revealDependencies: {
      quiz: false,
    },
    timestamps: true,
  };

  // overwrite default config with manual config
  var config = {...defaultConfig, ...Reveal.getConfig().tracking};
  // define necessary timers
  var slideTimer, globalTimer, quizTimer;
  // this object is sent to the trackingAPI on window#pagehide
  var postBody = {};
  var consentGiven = false;
  var userToken;

  /** 
   * Validate API configuration for tracking plug-in.
   */
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

  /**
   * Load the user token:
   * - from cookies
   * - from HTML local storage
   * - from authentication API
   */
  async function loadUserToken() {
    userToken = _getCookie('user_token') || window.localStorage.getItem('user_token');

    let isValid = await _userTokenIsValid();
    consentGiven = true;

    if (!isValid) {
      await _requestUserToken();
    }
  }

  /**
   * Display consent banner.
   */
  function showConsentBanner() {
    if (userToken == undefined) {
      _loadStylesheet(document.currentScript.src + '/../../css/tracking.css');
      let cbConfig = config.consentBanner;

      // create consent banner node
      let consentBanner = document.createElement('div');
      consentBanner.classList.add('consent-banner');
      consentBanner.innerHTML = _strip(`
        <p class="consent-banner--info-text">
          ${cbConfig.infoText}
          <a class="${cbConfig.moreLink.class}" href="${cbConfig.moreLink.href || '#'}" target="_blank">${cbConfig.moreLink.text}</a>
        </p>
        <button class="${cbConfig.consentButton.class}">${cbConfig.consentButton.text}</button>
        <a class="${cbConfig.closeButton.class}">${cbConfig.closeButton.text}</a>
      `);

      // define event listeners for closing the banner and giving consent
      consentBanner.querySelector(`.${cbConfig.closeButton.class}`).addEventListener('click', function() {
        consentBanner.remove();
        consentGiven = false;
      });

      consentBanner.querySelector(`.${cbConfig.consentButton.class}`).addEventListener('click', function() {
        consentBanner.remove();
        consentGiven = true;
        _requestUserToken();
      });

      // add consent banner to DOM
      document.body.prepend(consentBanner);
    }
  }

  /**
   * Add all event listeners for tracking.
   */
  function addEventListeners() {
    _trackClosing();
    _trackDwellTimes();
    _trackLinks();
    _trackSlideTransitions();
    _trackMediaActions();
    _trackQuizzes();
  }

  // Consent Banner: helper functions

  /**
   * Load consent banner stylesheet.
   */
  function _loadStylesheet(path) {
    let link  = window.document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = path;

    window.document.getElementsByTagName('head')[0].appendChild(link);
  }

  /**
   * Query authentication API to check whether the current user
   * token is valid.
   */
  async function _userTokenIsValid() {
    if (
      config.apiConfig.authentication == undefined ||
      config.apiConfig.authentication.validateTokenEndpoint == undefined
    ) {
      return true;
    }

    try {
      let response = await fetchRetry(config.apiConfig.authentication.validateTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_token: userToken }),
      });
      let data = await response.json();

      return data.valid;
    } catch(err) {
      console.warn(err);
      return false;
    }
  }

  /**
   * Request user token from authentication API.
   */
  async function _requestUserToken() {
    if (
      config.apiConfig.authentication == undefined ||
      config.apiConfig.authentication.requestTokenEndpoint == undefined
    ) {
      userToken = null;
      _removeCookie('user_token');
      window.localStorage.removeItem('user_token');
      return;
    }

    try {
      let response = await fetchRetry(config.apiConfig.authentication.requestTokenEndpoint, {
        method: 'POST',
      });
      let data = await response.json();

      userToken = data.user_token;
      window.localStorage.setItem('user_token', data.user_token);
      _setCookie('user_token', data.user_token);
    } catch(err) {
      console.warn(err)
      userToken = null;
    }
  }

  // Tracking logic: helper functions

  /**
   * Track dwell time per slide.
   */
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

  /**
   * Track last dwell time per slide and total dwell time.
   * Also send data to trackingAPI.
   */
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

  /**
   * Track clicks on links.
   */
  function _trackLinks() {
    let tracksInternalLinks = config.links === true || config.links.internal;
    let tracksExternalLinks = config.links === true || config.links.external;

    if (tracksInternalLinks || tracksExternalLinks) {
      // Retrieve all links
      postBody.links = postBody.links || [];
      Reveal.addEventListener('slidechanged', function() {
        document.querySelectorAll(`#${Reveal.getCurrentSlide().id} a`).forEach(function(link) {
          let isInternalLink = link.href.startsWith('#');

          if (isInternalLink) {
            if (tracksInternalLinks) {
              let matches = link.href.match(/#\/(\d+)\/(\d+)/);
              postBody.links[link.href] = {
                clicked: false,
                linkData: {
                  link: link.href,
                  linkText: link.text,
                  targetSlide: {
                    horizontalIndex: matches[1],
                    verticalIndex: matches[2],
                  },
                },
              }
            }
          } else {
            if (tracksExternalLinks) {
              postBody.links[link.href] = {
                clicked: false,
                linkData: {
                  link: link.href,
                  linkText: link.text,
                },
              }
            }
          }
        });
      });

      // Add click event listeners
      document.addEventListener('click', function(event) {
        if (!event.target.matches(`#${Reveal.getCurrentSlide().id} a`)) return true;

        let isInternalLink = event.target.href.startsWith('#');

        if ((isInternalLink && tracksInternalLinks) || (!isInternalLink && tracksExternalLinks)) {
          let linkType = isInternalLink ? 'internalLink' : 'externalLink';
          let eventData = { clicked: true };
          if (options.timestamp) eventData.clickedAt = globalTimer.toString();

          _track(linkType, eventData, { id: event.target.href });

          if (config.timeline) {
            let timelineData = {
              link: event.target.href,
              linkText: event.target.text,
              timeline: eventData.clickedAt || globalTimer.toString(),
            };

            if (isInternalLink) {
              let indices = event.target.href.match(/#\/(\d+)\/(\d+)/);
              timelineData.targetSlide = {
                horizontalIndex: indices[1],
                verticalIndex: indices[2],
              };
            }

            _addToTimeline(linkType, timelineData);
          }
        }
      });
    }
  }

  /**
   * Track slide transitions.
   */
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

        if (config.timeline) {
          data.timestamp = data.timestamp || globalTimer.toString();
          _addToTimeline('slideTransition', data);
        }
      });
    }
  }

  /**
   * Track audio and video (play, pause, progress).
   */
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
          played: false,
          mediaData: {
            source: this.currentSrc,
          },
          slideData: {
            slideNumber: Reveal.getSlides().indexOf(Reveal.getSlide(horizontalIndex, verticalIndex)) + 1,
            horizontalIndex: horizontalIndex,
            verticalIndex: verticalIndex,
            mediaIndex: mediaIndex,
          }
        };

        media.addEventListener('play', function () {
          let eventData = { played: true };
          if (config.timestamps) {
            eventData.playedAt = globalTimer.toString();
          }

          _track(mediaType, eventData, {
            id: this.id,
          });

          if (config.timeline) {
            _addToTimeline(mediaType, {
              mediaEvent: 'play',
              mediaID: this.id,
              mediaSource: this.currentSrc,
              timestamp: eventData.playedAt || globalTimer.toString(),
            });
          }
        });

        media.addEventListener('pause', function () {
          let eventData = {
            finished: this.ended,
            progress: this.currentTime / this.duration,
          };
          if (config.timestamps) {
            eventData.pausedAt = globalTimer.toString();
          }

          _track(mediaType, eventData, {
            id: this.id,
          });

          if (config.timeline) {
            _addToTimeline(mediaType, {
              mediaEvent: 'pause',
              finished: this.ended,
              progress: this.currentTime / this.duration,
              mediaID: this.id,
              mediaSource: this.currentSrc,
              timestamp: eventData.pausedAt || globalTimer.toString(),
            });
          }
        });
      });
    }
  }

  /**
   * Track quizzes from plug-in
   * [reveal.js-quiz](https://gitlab.com/schaepermeier/reveal.js-quiz).
   * Includes score, and whether they were started and completed.
   */
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
          started: false,
          completed: false,
          quizMetadata: {
            name: quizConfig.info.name,
            topic: quizConfig.info.main,
            numberOfQuestions: quizConfig.questions.length,
          },
          slideData: {
            slideNumber: Reveal.getSlides().indexOf(slide) + 1,
            horizontalIndex: slideIndices.h,
            verticalIndex: slideIndices.v,
          },
        };

        quizConfig.events = quizConfig.events || {};

        function trackQuizStart() {
          quizTimer = new Timer();
          quizTimer.start();

          _track('quiz', { started: true }, { id: quizName });
          
          if (config.timeline) {
            _addToTimeline('quiz', {
              quizEvent: 'start',
              quizID: quizName,
              timestamp: quizTimer.toString(),
            });
          }
        }

        function trackQuizComplete(options) {
          let dwellTime = quizTimer.toString();
          quizTimer.clear();

          _track('quiz', {
            completed: true,
            score: options.score,
            dwellTime: dwellTime,
          }, { id: quizName });

          if (config.timeline) {
            _addToTimeline('quiz', {
              quizEvent: 'complete',
              quizID: quizName,
              completed: true,
              score: options.score,
              dwellTime: dwellTime,
              timestamp: quizTimer.toString(),
            });
          }
        }

        if (quizConfig.events.onStartQuiz) {
          let existingCallback = quizConfig.events.onStartQuiz;
          quizConfig.events.onStartQuiz = function() {
            trackQuizStart();
            existingCallback();
          }
        } else {
          quizConfig.events.onStartQuiz = function() {
            trackQuizStart();
          }
        }

        if (quizConfig.events.onCompleteQuiz) {
          let existingCallback = quizConfig.events.onCompleteQuiz;
          quizConfig.events.onCompleteQuiz = function(options) {
            trackQuizComplete(options);
            existingCallback(options);
          }
        } else {
          quizConfig.events.onCompleteQuiz = function(options) {
            trackQuizComplete(options);
          }
        }
      });
    }
  }

  // Helper methods.

  /**
   * Helper method to add event data to post body.
   */
  function _track(eventType, eventData, options = {}) {
    let event;
    if (eventType == 'dwellTimePerSlide') {
      event = _eventWithSlideData(eventType, eventData, options);
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
        postBody.links = postBody.links || {};
        postBody.links[options.id] = postBody.links[options.id] || {};
        postBody.links[options.id] = {
          ...postBody.links[options.id],
          ...eventData,
        }
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

  /**
   * Add event to timeline. Timeline events always include a timestamp.
   */
  function _addToTimeline(eventType, eventData) {
    if (config.timeline) {
      postBody.timeline = postBody.timeline || [];
      let event = _eventWithSlideData(eventType, eventData);
      postBody.timeline.push(event);
    }
  }

  /**
   * Helper method to add slide metadata to event data.
   */
  function _eventWithSlideData(eventType, eventData, options = {}) {
    let slideIndices = Reveal.getIndices();
    let event = {
      type: eventType,
      ...eventData,
      slideData: {
        slideNumber: Reveal.getSlidePastCount() + 1,
        horizontalIndex: slideIndices.h,
        verticalIndex: slideIndices.v,
      },
    };

    if (!options.timestamp && config.timestamps) {
      event.timestamp = globalTimer.toString();
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
   *   quizzes: Object,
   *   timeline: Array
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

  /**
   * Adapter for fetch API with retries.
   */
  async function fetchRetry(url, options, retries = 3) {
    try {
      return await fetch(url, options);
    } catch(err) {
      if (retries === 1) throw err;
      return await fetchRetry(url, options, retries - 1);
    }
  };

  /**
   * Retrieve cookie by key.
   */
  function _getCookie(key) {
    let cookie = document.cookie.split(';').filter(cookie => cookie.trim().startsWith(`${key}=`))[0];
    if (cookie) {
      return cookie.trim().split('=')[1];
    }
    return null;
  }

  /**
   * Set cookie for a given key and value.
   */
  function _setCookie(key, value) {
    if (key && value) {
      let date = new Date();
      date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
      document.cookie = `${key}=${value}; expires=${date.toGMTString()}`;
    }
  }

  /**
   * Delete cookie by key.
   */
  function _removeCookie(key) {
    if (key) {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }

  /**
   * Remove unnecessary spaces and line breaks from string.
   */
  function _strip(string) {
    return string.trim().replace(/(\s)+/g, ' ').replace(/\n/g, '');
  }

  /**
   * Returns whether the tracking plug-in is allowed
   * to track the total dwell time.
   */
  function _tracksTotalDwellTime() {
    return config.dwellTime === true || config.dwellTime.total;
  }

  /**
   * Returns whether the tracking plug-in is allowed
   * to track the dwell time per slide.
   */
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

      // Register event listeners for tracking
      addEventListeners();
      // Load and verify user token if it exists,
      // then show the consent banner if applicable.
      loadUserToken().then(()=> showConsentBanner());
    },
  }
})();

Reveal.registerPlugin('tracking', RevealTracking);
