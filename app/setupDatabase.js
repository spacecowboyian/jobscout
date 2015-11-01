var rethink = require('rethinkdb'),
  getTimeStamp = require('./helpers/getTimeStamp')
  
var connection
var db

rethink.connect({
  host: 'localhost',
  port: 28015,
}, function(err, conn) {
  if (err) {
    throw new Error(getTimeStamp() + 'cannot connect to rethinkdb: ', err)
  }
  connection = conn
  exports.connection = connection
  createDatabase()
})

function createDatabase() {
  rethink.dbList().run(connection, function(err, dbs) {
    if (err) {
      throw new Error(getTimeStamp() +
        'error getting the list of databases: ', err)
    }
    if (dbs.indexOf('jobscout') === -1) {
      rethink.dbCreate('jobscout').run(connection, function(err, response) {
        console.log('created jobscout database')
      })
    }
    db = rethink.db('jobscout')
    exports.db = db
    createTables()
  })
}

function createTables() {
  db.tableList().run(connection, function(err, tables) {
    if (err) {
      throw new Error(getTimeStamp() +
        'error getting the list of databases: ', err)
    }
    createTableWithName('jobs');

    function createTableWithName(tableName) {
      if (tables.indexOf(tableName) === -1) {
        db.tableCreate(tableName).run(connection, function(err,
          response) {
          if (err) {
            throw new Error(getTimeStamp() +
              'error creating table with name: ' + tableName)
          }
          console.log('table created with name: ' + tableName)
          createIndex()
        })
      }
    }
  })
}

function createIndex () {
  db.table('jobs').indexCreate('jobkey').run(connection, function(err, response) {
    if (err) {
      throw new Error('Error creating the jobkey index: ', err)
    }

    console.info('creating the jobkey index')
  })
  db.table('jobs').indexCreate('url').run(connection, function(err, response) {
    if (err) {
      throw new Error('Error creating the url index: ', err)
    }

    console.info('creating the url index')
  })
}