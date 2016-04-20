/**
 * Created by kstratis on 4/20/16.
 */
var express = require('express');        // call express
var app = express();                 // define our app using express
var bodyParser = require('body-parser');
var Client = require('./app/models/client');
var mongoose   = require('mongoose');
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
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
    .get(function(req, res) {
        Client.find(function(err, clients) {
            if (err)
                res.send(err);
            res.json(clients);
        });
    })
    // CREATE A CLIENT (accessed at POST http://localhost:8080/api/clients)
    .post(function(req, res) {
        var client = new Client();      // create a new instance of the Client model
        client.orgId = req.body.orgId;  // set the clients name (comes from the request)
        // save the client and check for errors
        client.save(function(err) {
            if (err)
                res.send(err);
            res.json({ message: 'Client created!' });
        });
    });
router.route('/clients/:client_orgId')
    // GET THE CLIENT WITH THE SPECIFIED ORGID (accessed at GET http://localhost:8080/api/clients/:orgId)
    .get(function(req, res) {
        var query = Client.findOne({ 'orgId':  req.params.client_orgId});
        query.exec(function (err, client) {
            if (err)
                res.send(err);
            res.json(client);
        });
    })
    // UPDATE THE CLIENT WITH THE SPECIFIED ORGID (accessed at GET http://localhost:8080/api/clients/:orgId)
    .put(function(req, res) {
        var query = Client.findOne({ 'orgId':  req.params.client_orgId});
        query.exec(function (err, client) {
            if (err)
                res.send(err);
            client.efrontHost = req.body.efrontHost;  // update the client's efrontpro host
            client.efrontApiKey = req.body.efrontApiKey;  // update the bears info
            client.save(function(err){
               if (err)
                   res.send(err);
                res.json({ message: 'Client configuration successfully updated'});
            });
        });
    });

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);