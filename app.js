// require the dependencies we installed
var app = require('express')();
var responseTime = require('response-time')
var axios = require('axios');
var redis = require('redis');

// create a new redis client and connect to our local redis instance
var client = redis.createClient();

// if an error occurs, print it to the console
client.on('error', function (err) {
    console.log("Error " + err);
});

app.set('port', (process.env.PORT || 5000));
// set up the response-time middleware
app.use(responseTime());

// call the GitHub API to fetch information about the user's repositories
function getUserRepositories(user) {
  var githubEndpoint = 'https://api.github.com/users/' + user + '/repos' + '?per_page=100';
  return axios.get(githubEndpoint);
}

// add up all the stars and return the total number of stars across all repositories
function computeTotalStars(repositories) {
  return repositories.data.reduce(function(prev, curr) {
    return prev + curr.stargazers_count
  }, 0);
}

// if a user visits /api/facebook, return the total number of stars 'facebook'
// has across all it's public repositories on GitHub
app.get('/api/:username', function(req, res) {
  // get the username parameter in the URL
  // i.e.: username = "coligo-io" in http://localhost:5000/api/coligo-io
  var username = req.params.username;

  // use the redis client to get the total number of stars associated to that
  // username from our redis cache
  client.get(username, function(error, result) {

      if (result) {
        // the result exists in our cache - return it to our user immediately
        res.send({ "totalStars": result, "source": "redis cache" });
      } else {
        // we couldn't find the key "coligo-io" in our cache, so get it
        // from the GitHub API
        getUserRepositories(username)
          .then(computeTotalStars)
          .then(function(totalStars) {
            // store the key-value pair (username:totalStars) in our cache
            // with an expiry of 1 minute (60s)
            client.setex(username, 60, totalStars);
            // return the result to the user
            res.send({ "totalStars": totalStars, "source": "GitHub API" });
          }).catch(function(response) {
            if (response.status === 404){
              res.send('The GitHub username could not be found. Try "coligo-io" as an example!');
            } else {
              res.send(response);
            }
          });
      }

  });
});

app.listen(app.get('port'), function(){
  console.log('Server listening on port: ', app.get('port'));
});
