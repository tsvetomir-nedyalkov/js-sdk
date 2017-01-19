import Request from './request';
import { KinveyResponse } from './response';
import UrlPattern from 'url-pattern';
import url from 'url';
import { KinveyError } from '../../errors';
import Query from '../../query';
import Aggregation from '../../aggregation';
import { isDefined } from '../../utils';
import { CacheRack } from './rack';

/**
 * @private
 */
export default class LocalRequest extends Request {
  constructor(options = {}) {
    super(options);
    this.aggregation = options.aggregation;
    this.query = options.query;
    this.rack = new CacheRack();
  }

  get query() {
    return this._query;
  }

  set query(query) {
    if (isDefined(query) && !(query instanceof Query)) {
      throw new KinveyError('Invalid query. It must be an instance of the Query class.');
    }

    this._query = query;
  }

  get aggregation() {
    return this._aggregation;
  }

  set aggregation(aggregation) {
    if (isDefined(aggregation) && !(aggregation instanceof Aggregation)) {
      throw new KinveyError('Invalid aggregation. It must be an instance of the Aggregation class.');
    }

    this._aggregation = aggregation;
  }

  get url() {
    return super.url;
  }

  set url(urlString) {
    super.url = urlString;
    const pathname = global.escape(url.parse(urlString).pathname);
    const pattern = new UrlPattern('(/:namespace)(/)(:appKey)(/)(:collection)(/)(:entityId)(/)');
    const { appKey, collection, entityId } = pattern.match(pathname) || {};
    this.appKey = appKey;
    this.collection = collection;
    this.entityId = entityId;
  }

  execute() {
    return super.execute()
      .then((response) => {
        if (!(response instanceof KinveyResponse)) {
          response = new KinveyResponse({
            statusCode: response.statusCode,
            headers: response.headers,
            data: response.data
          });
        }

        // Throw the response error if we did not receive
        // a successfull response
        if (!response.isSuccess()) {
          throw response.error;
        }

        // If a query was provided then process the data with the query
        if (isDefined(this.query) && isDefined(response.data)) {
          response.data = this.query.process(response.data);
        }

        // If an aggregation was provided then process the data with the aggregation
        if (isDefined(this.aggregation) && isDefined(response.data)) {
          response.data = this.aggregation.process(response.data);
        }

        // Just return the response
        return response;
      });
  }

  toPlainObject() {
    const obj = super.toPlainObject();
    obj.appKey = this.appKey;
    obj.collection = this.collection;
    obj.entityId = this.entityId;
    obj.encryptionKey = this.client ? this.client.encryptionKey : undefined;
    return obj;
  }
}
