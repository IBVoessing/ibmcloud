var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ClientSchema = new Schema({
    name: String,
    orgId: Number,
    
});

module.exports = mongoose.model('Bear', BearSchema);
