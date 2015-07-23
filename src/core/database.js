import Dexie from 'dexie';
import utils from '../utils';
import Kinvey from '../kinvey';
const indexedDBShim = require(process.env.KINVEY_DATABASE_LIB);

// Setup Dexie dependencies
Dexie.dependencies.indexedDB = indexedDBShim;

if (process.env.KINVEY_PLATFORM_ENV === 'node') {
  Dexie.dependencies.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
  Dexie.dependencies.IDBTransaction = require('fake-indexeddb/lib/FDBTransaction');
}

const version = 1;
const datbaseSymbol = Symbol();

// const objectIdPrefix = 'local_';

// function generateObjectId(prefix = '', length = 24) {
//   let chars = 'abcdef0123456789';
//   let objectId = '';

//   for (let i = 0, j = chars.length; i < length; i++) {
//     let pos = Math.floor(Math.random() * j);
//     objectId = objectId + chars.substring(pos, pos + 1);
//   }

//   return `${prefix}${objectId}`;
// }

class Database {
  constructor(name = 'Kinvey') {
    // Set the database name
    this.name = name;

    // Create a new database
    const db = new Dexie(this.name);
    this.db = db;

    // Define the schema
    db.version(version).stores({
      data: '_id'
    });

    // Open the database
    db.open();
  }

  /**
   * Read a document from the database.
   *
   * @param  {String}  id   Id of the document.
   * @return {Promise}      The document.
   */
  static read(id = '') {
    const database = Database.instance();
    const db = database.db;

    // Open a read transaction
    return db.transaction('r', db.data, () => {
      // Retrieve the document
      return db.data.where('_id').equals(id).first();
    });
  }

  /**
   * Save a document to the database.
   *
   * @param  {Object}   doc The document to be saved.
   * @return {Promise}      The document.
   */
  static save(doc = {}) {
    const database = Database.instance();
    const db = database.db;

    // Open a read/write transaction
    return db.transaction('rw', db.data, () => {
      // Save the document
      db.data.put(doc);
    });
  }

  /**
   * Delete a document from the database.
   *
   * @param  {String}  id   Id of the document.
   * @return {Promise}      The document.
   */
  static destroy(id = '') {
    const database = Database.instance();
    const db = database.db;

    // Open a read/write transaction
    return db.transaction('rw', db.data, () => {
      // Delete the document
      return db.data.where('_id').equals(id).delete();
    });
  }

  /**
   * Singleton instance of the Database
   *
   * @return {Database} Database instance.
   */
  static instance() {
    let database = Database[datbaseSymbol];

    if (!utils.isDefined(database)) {
      database = new Database(`Kinvey.${Kinvey.appKey}`);
      Database[datbaseSymbol] = database;
    }

    return database;
  }
}

export default Database;
