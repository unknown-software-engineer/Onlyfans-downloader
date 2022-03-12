// ==UserScript==
// @name         Onlyfans downloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Help you to download onlyfans' media
// @author       Unknownman
// @match        https://onlyfans.com/*
// @icon         https://static.onlyfans.com/theme/onlyfans/spa/icons/favicon-notification-32x32.png
// @grant        GM_download
// ==/UserScript==
(function (){
  const parentId = createRandomStr();
  const statusId = createRandomStr();
  const scrollToEndCheckboxId = createRandomStr();
  const videoIncludeCheckboxId = createRandomStr();
  const imageIncludeCheckboxId = createRandomStr();
  const downloadButtonId = createRandomStr();
  const closeButtonId = createRandomStr();
  const forceStartDownloadButtonId = createRandomStr();
  const listWrapperSelector = '#content > div.l-wrapper > div.l-wrapper__content > div.b-feed-content.g-sides-gaps > div.b-photos.g-negative-sides-gaps';
  const scrollToEndMaxRetryTimes = 20;
  const sleepMs = 500;
  let isForceStartToDownload = false;

  let hasSetProxy = false;
  let data = {
    videos: 0,
    images: 0,
    collectedVideos: 0,
    collectedImages: 0,
    downloadedVideos: 0,
    downloadedImages: 0,
  };
  const dataIds = {
    videos: createRandomStr(),
    images: createRandomStr(),
    collectedVideos: createRandomStr(),
    collectedImages: createRandomStr(),
    downloadedVideos: createRandomStr(),
    downloadedImages: createRandomStr(),
  };

  const needToDownloadVideosUrls = [];
  const needToDownloadImagesUrls = [];

  function createRandomNumber(min = 5, max = 30) {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

  function createRandomStr(len = createRandomNumber()) {
    let result = '';
    const string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

    for (let i = 0; i < len; i++) {
      result += string[createRandomNumber(0, string.length)];
    }

    return result;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /**
   * create a div
   * @param {string} element
   * @param {string} id
   * @param {string} className
   * @param {HTMLElement} parentDom if set, the created div will append to the parentDom
   * @param {object} style
   * @param {object} attributes
   */
  function createElement(element, id = '', className = '', parentDom = undefined, style= undefined , attributes = undefined) {
    const el = document.createElement(element);

    id && el.setAttribute('id', id);
    className && el.setAttribute('class', className);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) =>{
        el.setAttribute(key, value);
      });
    }

    if (style) {
      Object.entries(style).forEach(([key, value]) =>{
        el.style[key] = value;
      });
    }

    if (parentDom) {
      parentDom.appendChild(el);
    }

    return el;
  }

  /**
   * get a element
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  function getElement(id) {
    return document.getElementById(id);
  }

  /**
   * create or find a div
   * @param {string} element
   * @param {string} id
   * @param {[string, HTMLElement, object, object]} args
   */
  function createOrGetElement(element, id, ...args) {
    return getElement(id) || createElement(element, id, ...args);
  }

  /**
   * remove a element
   * @param {string} id
   */
  function remoteElement(id) {
    const el = document.getElementById(id);
    if (el) {
      el.parentElement.removeChild(el);
    }
  }

  /**
   * create an element and set its innerHTML
   * @param {string|number} text
   * @param {[string, string, string, HTMLElement, object, object]} args
   * @returns {HTMLElement}
   */
  function createElementAndSetInnerHtml(text, ...args) {
    const el = createElement(...args);

    el.innerHTML = text;

    return el;
  }

  /**
   * create a button
   * @param {string} id
   * @param {string} text
   * @param {HTMLElement} parentEl
   * @param {string} appendClassName
   * @returns {HTMLElement}
   */
  function createButton(id, text, parentEl = undefined, appendClassName) {
    const button = createElement('button', id, 'm-rounded g-btn' + (appendClassName ? ` ${appendClassName}` : ''), parentEl);
    button.innerHTML = text;

    return button;
  }

  /**
   * create a button with wrapper
   * @param {string} id
   * @param {string} text
   * @param {HTMLElement} parentEl
   * @param {string} buttonAppendClassName
   * @returns {HTMLElement} the button element
   */
  function createButtonWithWrapper(id, text, parentEl = undefined, buttonAppendClassName = '') {
    const div = createElement('div', '', 'b-offer-wrapper', parentEl);

    return createButton(id, text, div, buttonAppendClassName);
  }

  /**
   * create a label with checkbox inside
   * @param {string} id
   * @param {boolean} checked
   * @param {string} labelText
   * @param {string} description
   * @param {HTMLElement} parentNode
   * @returns {HTMLElement}
   */
  function createCheckboxWithLabel(id, checked, labelText, description, parentNode) {
    const label = createElement('label', '', 'b-users-lists__item__label m-collection-item b-input-radio__container');
    label.innerHTML = `<input id="${id}" type="checkbox" class="b-input-radio m-only-by-class">
    <label for="${id}" class="b-input-radio__label">
      <svg class="g-icon" aria-hidden="true">
        <use xlink:href="#icon-done" href="#icon-done"></use>
      </svg>
      <span class="b-input-ripple"></span>
    </label>
    <div class="b-users-lists__item m-with-rectangle-hover m-tb-sm m-border-full-width">
      <div class="b-users-lists__item__text">
        <div class="b-users-lists__item__name m-size-sm-text"> ${labelText}</div>
        <div class="b-users-lists__item__count"> ${description}</div>
      </div>
    </div>`;

    parentNode.appendChild(label);

    /**
     * @type {HTMLInputElement|null}
     */
    const input = getElement(id);

    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        input.classList.add('m-checked');
      } else {
        input.classList.remove('m-checked');
      }
    });

    if (checked) {
      input.click();
    }
  }

  /**
   * check if checkbox checked
   * @param id
   * @returns {boolean}
   */
  function isCheckboxChecked(id) {
    /**
     * @type {HTMLInputElement}
     */
    const checkbox = getElement(id);

    return checkbox.checked;
  }

  /**
   * create an item block
   * @param {string} title
   * @param {HTMLElement} parentEl
   * @param {string} contentClassName
   * @param {string} wrapperAppendClassName
   * @returns {HTMLElement}
   */
  function createItemBlock(title, parentEl, contentClassName = 'b-offer-join', wrapperAppendClassName = '') {
    const block = createElement('li', '', `b-profile__content__item${wrapperAppendClassName ? ' ' + wrapperAppendClassName : ''}`, parentEl);

    const listOffers = createElement('div', '', 'list-offers m-offer-bottom-gap-reset', block);
    const wrapper = createElement('div', '', 'b-offer-wrapper m-start-campaign m-started-campaign', listOffers);
    const titleDiv = createElement('div', '', 'b-profile__content__item__title', wrapper);
    const linkDiv = createElement('div', '', 'b-profile__bio__link', titleDiv);
    linkDiv.innerHTML = title;

    return createElement('div', '', contentClassName, wrapper);
  }

  function createStatusBlock(parentEl) {
    const content = createItemBlock('Status', parentEl);
    const line1 = createElement('span', '', 'b-users__item__subscription-date', content);
    createElementAndSetInnerHtml('', 'span', statusId, 'b-users__item__subscription-date__label', line1);
    setCurrentStatus('Waiting to start');
  }

  function setCurrentStatus(text) {
    getElement(statusId).innerText = text;
  }

  /**
   * create check block
   * @param parentEl
   */
  function createCheckBlock(parentEl) {
    const content = createItemBlock('Settings', parentEl, 'b-offer-join', 'b-users-lists m-collections-list m-native-custom-scrollbar m-scrollbar-y m-invisible-scrollbar');

    createCheckboxWithLabel(scrollToEndCheckboxId, true, 'Scroll To End', 'Scroll to End to load all media', content);
    createCheckboxWithLabel(videoIncludeCheckboxId, true, 'Include Video', 'Download all videos', content);
    createCheckboxWithLabel(imageIncludeCheckboxId, true,'Include Image', 'Download all images', content);
  }

  function setInfoBlock(parentEl) {
    const content = createItemBlock('Information', parentEl);

    const line1 = createElement('span', '', 'b-users__item__subscription-date', content);
    const line2 = createElement('span', '', 'b-users__item__subscription-date', content);
    const line3 = createElement('span', '', 'b-users__item__subscription-date', content);
    const line4 = createElement('span', '', 'b-users__item__subscription-date', content);
    const line5 = createElement('span', '', 'b-users__item__subscription-date', content);
    const line6 = createElement('span', '', 'b-users__item__subscription-date', content);

    createElementAndSetInnerHtml('Recognized Videos:', 'span', '', 'b-users__item__subscription-date__label', line1);
    createElementAndSetInnerHtml(data.videos, 'span', dataIds.videos, 'b-users__item__subscription-date__value', line1);

    createElementAndSetInnerHtml('Recognized Images:', 'span', '', 'b-users__item__subscription-date__label', line2);
    createElementAndSetInnerHtml(data.images, 'span', dataIds.images, 'b-users__item__subscription-date__value', line2);

    createElementAndSetInnerHtml('Collected Videos:', 'span', '', 'b-users__item__subscription-date__label', line3);
    createElementAndSetInnerHtml(data.collectedVideos, 'span', dataIds.collectedVideos, 'b-users__item__subscription-date__value', line3);

    createElementAndSetInnerHtml('Collected Images:', 'span', '', 'b-users__item__subscription-date__label', line4);
    createElementAndSetInnerHtml(data.collectedImages, 'span', dataIds.collectedImages, 'b-users__item__subscription-date__value', line4);

    createElementAndSetInnerHtml('Downloaded Videos:', 'span', '', 'b-users__item__subscription-date__label', line5);
    createElementAndSetInnerHtml(data.downloadedVideos, 'span', dataIds.downloadedVideos, 'b-users__item__subscription-date__value', line5);

    createElementAndSetInnerHtml('Downloaded Images:', 'span', '', 'b-users__item__subscription-date__label', line6);
    createElementAndSetInnerHtml(data.downloadedImages, 'span', dataIds.downloadedImages, 'b-users__item__subscription-date__value', line6);
  }

  function createDownloadBlock(parentEl) {
    const content = createItemBlock('Methods', parentEl, 'b-tab-container');
    const wrapper = createElement('div', '', 'b-offer-wrapper', content);

    const downloadStartButton = createButtonWithWrapper(downloadButtonId, 'Start Download', wrapper);
    const forceStartDownload = createButtonWithWrapper(forceStartDownloadButtonId, 'Force To Start Download', wrapper, 'm-danger');
    const closeButton = createButtonWithWrapper(closeButtonId, 'Close Downloader', wrapper, 'm-danger');

    downloadStartButton.addEventListener('click', () => {
      download().then(() => {
        //
      });
    });

    forceStartDownload.addEventListener('click', () => {
      isForceStartToDownload = true;
    });

    closeButton.addEventListener('click', () => {
      remoteElement(parentId);
    })
  }

  function scrollToEnd() {
    let retryTimes = 0;
    if (isCheckboxChecked(scrollToEndCheckboxId)) {
      return new Promise((resolve) => {
        function smoothScroll() {
          setCurrentStatus('Scrolling to the end');
          if (isForceStartToDownload) {
            return resolve();
          }
          const currentScroll = document.documentElement.scrollTop || document.body.scrollTop;
          const clientHeight = document.documentElement.clientHeight;
          const scrollHeight = document.documentElement.scrollHeight;
          if (scrollHeight - 10 > currentScroll + clientHeight) {
            window.requestAnimationFrame(smoothScroll);
            window.scrollTo(0, currentScroll + (scrollHeight - currentScroll - clientHeight) / 2);

            setInterval(() => {
              const loadingContainer = document.getElementsByClassName('infinite-loading-container');
              if (loadingContainer && loadingContainer[0]) {
                if (loadingContainer[0].firstElementChild.style.display === 'none') {
                  return resolve();
                }
              }
              if (document.documentElement.scrollHeight > scrollHeight) {
                retryTimes = 0;
                smoothScroll();
              } else {
                if (retryTimes < scrollToEndMaxRetryTimes) {
                  retryTimes ++;
                  smoothScroll();
                } else {
                  return resolve();
                }
              }
            }, 1500);
          }
        }

        smoothScroll();
      });
    }
  }

  function switchToMediaPage() {
    const tab = document.querySelector('#content > div.l-wrapper > div.l-wrapper__content > div.l-profile-container > div > ul > li:nth-child(2) > a');
    tab && tab.click();
  }

  /**
   *
   * @param {HTMLElement} item
   * @returns {HTMLElement}
   */
  async function openMedia(item) {
    item.click();
    const container = await waitToGetElementByClassName(document.body, 'pswp__container');
    return container.children[1];
  }

  async function closeDialog() {
    const button = await waitToGetElementByClassName(document.body, 'pswp__button--close');
    button.click();
  }

  /**
   * @param {HTMLElement} wrapper
   * @param {string} tag
   * @returns {Promise<HTMLElement>}
   */
  async function waitToGetElementByTag(wrapper, tag) {
    while(1) {
      const target = wrapper.getElementsByTagName(tag);
      if (target && target[0]) {
        return target[0];
      } else {
        await sleep(200);
      }
    }
  }

  /**
   * @param {HTMLElement} wrapper
   * @param {string} className
   * @returns {Promise<HTMLElement>}
   */
  async function waitToGetElementByClassName(wrapper, className) {
    while(1) {
      const target = wrapper.getElementsByClassName(className);
      if (target && target[0]) {
        return target[0];
      } else {
        await sleep(200);
      }
    }
  }

  /**
   * @param {HTMLElement[]} videos
   */
  async function downloadVideos(videos) {
    for (let i = 0; i < videos.length; i++){
      setCurrentStatus(`Collect ${i + 1} video(s)`);
      data.collectedVideos++;
      const item = await openMedia(videos[i]);
      const tag = await waitToGetElementByTag(item, 'video');
      needToDownloadVideosUrls.push(tag.getAttribute('src'));
      await closeDialog();
      await sleep(sleepMs);
    }
  }

  /**
   * @param {HTMLElement[]} images
   */
  async function downloadImages(images) {
    for (let i = 0; i < images.length; i++){
      setCurrentStatus(`Collect ${i + 1} image(s)`);
      data.collectedImages++;
      const item = await openMedia(images[i]);
      const tag = await waitToGetElementByTag(item, 'img');
      needToDownloadImagesUrls.push(tag.getAttribute('src'));
      await closeDialog();
      await sleep(sleepMs);
    }
  }

  async function collectMedia() {
    const includeVideo = isCheckboxChecked(videoIncludeCheckboxId);
    const includeImage = isCheckboxChecked(imageIncludeCheckboxId);
    const videos = [];
    const images = [];

    const list = document.querySelector(listWrapperSelector);

    if (list) {
      for (const item of list.children) {
        if (item.classList.contains('m-video-item')) {
          if (includeVideo) {
            setCurrentStatus('Recognize a video');
            data.videos ++;
            videos.push(item);
          }
        } else if (item.classList.contains('b-photos__item')) {
          if (includeImage) {
            setCurrentStatus('Recognize a image');
            data.images ++;
            images.push(item);
          }
        }
      }

      if (videos.length) {
        await downloadVideos(videos);
      }

      if (images.length) {
        await downloadImages(images);
      }

      downloadAllUrls();
    } else {
      alert('Cannot find media list wrapper. Please check whether if you are subscribe to him.')
    }
  }

  function downloadAllUrls() {
    setCurrentStatus(`Download media`);
    for (let i = 0; i < needToDownloadVideosUrls.length; i++){
      GM_download({
        url: needToDownloadVideosUrls[i],
        name: window.document.title + '_' + (i + 1) + '.mp4',
        saveAs: false,
        onload: () => {
          data.downloadedVideos++;
        },
      });
    }

    for (let i = 0; i < needToDownloadImagesUrls.length; i++){
      GM_download({
        url: needToDownloadImagesUrls[i],
        name: window.document.title + '_' + (i + 1) + '.jpg',
        saveAs: false,
        onload: () => {
          data.downloadedImages++;
        },
      });
    }
  }

  function initData() {
    setCurrentStatus('Init data');
    data.videos = 0;
    data.images = 0;
    data.collectedVideos = 0;
    data.collectedImages = 0;
    data.downloadedImages = 0;
    data.downloadedVideos = 0;
    isForceStartToDownload = false;
    needToDownloadVideosUrls.splice(0, needToDownloadVideosUrls.length);

    if (!hasSetProxy) {
      data = new Proxy(data, {
        set(target, p, value) {
          const el = getElement(dataIds[p]);

          if (el) {
            el.innerText = value;
          }

          Reflect.set(target, p, value);
        }
      });
      hasSetProxy = true;
    }
  }

  async function download() {
    initData();
    switchToMediaPage();
    await sleep(500);
    await scrollToEnd();
    await collectMedia();
    setCurrentStatus(`Download success!`);
  }

  function init() {
    const parentElStyle = {
      width: '300px',
      minHeight: 'auto',
      padding: '10px',
      background: '#FFF',
      position: 'fixed',
      top: 'inherit',
      left: '30px',
      bottom: '30px',
      borderRadius: '6px',
      zIndex: 1000
    };
    const parentEl = createElement('div', parentId, 'l-wrapper__sidebar b-profile-list b-bundles-group', document.body, parentElStyle);
    const list = createElement('ul', '','b-profile__content__list', parentEl);

    createStatusBlock(list);
    createCheckBlock(list);
    setInfoBlock(list);
    createDownloadBlock(list);
  }

  function run(){
    init();
  }

  run();
})()
