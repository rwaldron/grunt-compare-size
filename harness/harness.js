module.exports = function( grunt ) {
grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "wip", head: "deadbeef", changed: true }); });
};