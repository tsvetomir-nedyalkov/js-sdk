"use strict";

before(function () {
  Kinvey.init({
    appKey: externalConfig.appKey,
    appSecret: externalConfig.appSecret
  });
});