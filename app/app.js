var _ = require( 'lodash' ),
    request = require( 'request' ),
    InfiniteLoop = require( 'infinite-loop' ),
    accounts = require( './accounts.json' ),
    jobTypes = require( './types.json' ),
    Twitter = require( 'twitter' ),
	rethink = require( 'rethinkdb' ),
	jobsDB = rethink.db('jobscout'),
	jobsTable = jobsDB.table('jobs'),
	jobs,
	jobList,
	connection,
	il = new InfiniteLoop,
	interval = parseInt(process.argv[ 3 ]),
	manualAccountName = process.argv[ 2 ];

rethink.connect({
  host: 'localhost',
  post: 28015
}, function(err, conn) {
  if (err) {
    throw new Error('Error connecting to rethinkdb: ', err)
  }

  connection = conn
});

var buildURL = function( account ) {
    var baseURL = 'http://api.indeed.com/ads/apisearch',
        params = {
            'publisher' : '5236162194932051',
            'q' : getQuery( account.type ),
            'l' : account.location,
            'latlong' : '1',
            'co' : 'us',
            'userip' : '199.59.149.230',
            'useragent' : 'Mozilla/5.0 Firefox/33.0',
            'v' : '2',
            'format' : 'json'
        },
        combine = function(params) {
            var lst = [];
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    lst.push(encodeURIComponent(key)+"="+encodeURIComponent(params[key]));
                }
            }
            return "?"+lst.join("&");
        },
        combineResult = combine( params );
        
        
    return baseURL + combineResult;
}

var getQuery = function( type ) {
    var match = _.find( jobTypes.jobTypes, function(obj) { return obj.type == type }),
        keywords = match.keywords.join();
        
    return keywords;
}

var pingAccount = function ( manualAccount ) {
    var accountArray = [],
        url;
        
    if ( manualAccount ) {
        accountArray.push( manualAccount );   
    } else {
        accountArray = accounts.accounts;
    }

    accountArray.forEach( function( account ) {
    	url = buildURL( account );
	    request( url, function ( error, response, body ) {
	        if ( !error && response.statusCode == 200 ) {
	            jobs = JSON.parse( body ); // We gots jsons!
	            parseJobs( jobs.results, account );
	        } else {
	            console.log( 'you gots no jsons' );
	        }
	    });
    });
}

if ( manualAccountName && manualAccountName != 'all' ) {
    var manualAccount = _.findWhere( accounts.accounts, { 'name': manualAccountName });
        
    pingAccount( manualAccount );
} else {
    il.add( pingAccount );
    il.run().setInterval( interval || 3000 );
}

var parseJobs = function( jobs, account ) {
    var jobKeys = [],
        usedJobs = [],
        newJobs,
        newJobsRefined = [];
    
    jobs.forEach( function( job ) {
        jobKeys.push( job.jobkey );
    });
    
    jobsTable.getAll(rethink.args(jobKeys), {index:'jobkey'}).run(connection, function( err, savedJobs ) {
        savedJobs.toArray(function(err, results) {
            if (err) throw err;
            results.forEach( function( result ) {
                usedJobs.push( result.jobkey );
            });
            newJobs = _.findByValues(jobs, 'jobkey', _.difference( jobKeys, usedJobs ));
            newJobs.forEach( function( job ) {
                var refinedJob = {
            		title: job.jobtitle,
            		company: job.company,
            		url: job.url,
            		createdOn: job.date,
            		jobkey: job.jobkey,
            		source: 'indeed'
            	}
            	
            	newJobsRefined.push( refinedJob );
            });

            if (newJobsRefined.length > 0 ) {
                postJobs ( account, newJobsRefined );
            } else {
            	console.log( 'no new jobs for ' + account.name );
            }
        });
    });    
};

var insertJobs = function( account, newJobs ) {
	jobsTable.insert( newJobs ).run(connection, function(err, response) {
		if (err) {
			console.log( 'error saving job' );
		} else {
			console.log( 'saved new jobs for ' + account.name );
		}
	})
}

var postJobs = function( account, jobs ) {
    var client = new Twitter({
        consumer_key: account.consumer,
        consumer_secret: account.consumerSecret,
        access_token_key: account.token,
        access_token_secret: account.tokenSecret
    });
    
    jobs.forEach( function( job ) {
        var jobTweet = job.title + ' - ' + job.company + ' ' + job.url;
        
        client.post( 'statuses/update', { status: jobTweet },  function( err, tweet, response ){
            if(err) throw err;
            console.log(tweet.text);
        });
        
    });
    
    insertJobs( account, jobs );
}

_.mixin({
  'findByValues': function(collection, property, values) {
    return _.filter(collection, function(item) {
      return _.contains(values, item[property]);
    });
  }
});