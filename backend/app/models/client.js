var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ClientSchema = new Schema({
    _id: String,
    efrontHost: String,
    efrontApiKey: String,
    UserId: String,
    displayName: String,
    email: String
});

module.exports = mongoose.model('Client', ClientSchema);
