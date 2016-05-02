/**
 * Created by kstratis on 4/20/16.
 */
var express = require('express');        // call express
var app = express();                 // define our app using express
var bodyParser = require('body-parser');
var Client = require('./app/models/client');
var mongoose = require('mongoose');
var path = require('path');
var basicAuth = require('basic-auth-connect');
// Configure app to use bodyParser() so that it will let us get the data from the POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var auth = basicAuth(function(user, pass) {
    return user === 'admin' && pass === 'admin';
});
app.use(express.static(path.join(__dirname, 'app/assets'))); //  "public" off of current is root
app.use(express.static(path.join(__dirname, 'app/public'))); //  "public" off of current is root
mongoose.connect('mongodb://localhost/nodeapidb'); // connect to our database
var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// router.use(function(req, res, next) {
//     // do logging
//     console.log('A new request just came in.');
//     next(); // make sure we go to the next routes and don't stop here
// });

// Test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'Hooray! welcome to our api!' });
});


router.route('/clients')
    // GET ALL CLIENTS - Security hazard! Use only for debugging
    .get(auth, function(req, res) {
        Client.find(function(err, clients) {
            if (err)
                res.send(err);
            res.json(clients);
        });
    })
    // CREATE A CLIENT (accessed at POST http://localhost:8080/api/clients)
    .post(function(req, res) {
        var client = new Client();      // create a new instance of the Client model
        client._id = req.body._id;  // set the clients name (comes from the request)
        client.efrontHost = req.body.efrontHost;  // set the clients name (comes from the request)
        client.efrontApiKey = req.body.efrontApiKey;  // set the clients name (comes from the request)

        // save the client and check for errors
        client.save(function(err) {
            if (err)
                res.send(err);
            res.json({ message: 'Client created!' });
        });
    });
router.route('/clients/:_id')
    // GET THE CLIENT WITH THE SPECIFIED ORGID (accessed at GET http://localhost:8080/api/clients/:_id)
    .get(function(req, res) {
        var query = Client.findOne({ '_id':  req.params._id});
        query.exec(function (err, client) {
            if (err)
                res.send(err);
            else if (client){
                res.json(client);
            }
            else{
                res.json({ message: 'Not Found' });
            }
                // console.log(mes);

            // Can't set headers after they are sent

        });
    })
    // UPDATE THE CLIENT WITH THE SPECIFIED ORGID (accessed at GET http://localhost:8080/api/clients/:_id)
    .put(function(req, res) {
        var query = Client.findOne({ '_id':  req.params._id});
        query.exec(function (err, client) {
            if (err)
                res.send(err);
            console.log(client);
            console.log(req.body);
            client.efrontHost = req.body.efrontHost;  // update the client's efrontpro host
            client.efrontApiKey = req.body.efrontApiKey;  // update the bears info
            client.save(function(err){
               if (err)
                   res.send(err);
                res.json({ message: 'Client updated'});
                console.log('client updated!');
            });
        });
    })
    .delete(auth, function(req, res) {
        Client.remove({
            _id: req.params._id
        }, function(err, client) {
            if (err)
                res.send(err);
            res.json({ message: 'Client successfully deleted' });
        });
    });


// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);