'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * @private
 * Enum for Social Identities
 */
var SocialIdentity = {
  Facebook: 'facebook',
  Google: 'google',
  Kinvey: process.env.KINVEY_IDENTITY || 'kinvey',
  LinkedIn: 'linkedin',
  MobileIdentityConnect: process.env.KINVEY_MIC_IDENTITY || 'kinveyAuth',
  Windows: 'windows'
};
Object.freeze(SocialIdentity);
exports.SocialIdentity = SocialIdentity;