var request = require( 'request' ),
	rethink = require( 'rethinkdb' ),
	jobsDB = rethink.db('jobscout'),
	jobsTable = jobsDB.table('jobs'),
	jobs,
	connection;

rethink.connect({
  host: 'localhost',
  post: 28015
}, function(err, conn) {
  if (err) {
    throw new Error('Error connecting to rethinkdb: ', err)
  }

  connection = conn
})


request( 'http://api.indeed.com/ads/apisearch?publisher=5236162194932051&q=design&l=kansas+city%2C+mo&latlong=1&co=us&userip=65.28.83.242&useragent=Mozilla/%2F4.0%28Firefox%29&v=2&format=json', function ( error, response, body ) {
  if ( !error && response.statusCode == 200 ) {
    jobs = JSON.parse( body ); // We gots jsons!

    parseJobs( jobs.results );
    //insertJob( jobs.results[0] );
  }
})

parseJobs = function( jobs ) {
	jobs.forEach ( function( job ) {
		var source = 'indeed', //hardcode for now
			jobkey = job.jobkey,
			url = job.url;

		if ( source === 'indeed' ) {
			jobsTable.getAll( jobkey, { index: 'jobkey'} ).run( connection, function(err, result) {
		      	var isNew = result._responses[0] !== undefined ? false : true;

		      	if ( isNew ) {
			    	insertJob( job );
			    } else {
			    	console.log( 'old job' );
			    }
		    });
		}
	});
};

insertJob = function( job ) {
	jobsTable.insert({
		title: job.jobtitle,
		url: job.url,
		createdOn: job.date,
		jobkey: job.jobkey,
		source: 'indeed'
	}).run(connection, function(err, response) {
		if (err) {
			console.log( 'nope' );
		} else {
			console.log( 'job: ' + job.jobtitle + ' - ' + job.jobkey );
		}
	})
}

