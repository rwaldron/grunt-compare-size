"use strict";

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    compare_size: {
      files: [
        "dist/source.js",
        "dist/source.min.js"
      ]
    },
    nodeunit: {
      tests: [ "test/**/*.js" ]
    },
    jshint: {
      files: [ "Gruntfile.js", "tasks/**/*.js", "test/**/*.js" ],
      options: {
        jshintrc: ".jshintrc"
      }
    },
    watch: {
      files: "<%= jshint.files %>",
      tasks: "default"
    }
  });

  // Load local tasks.
  grunt.loadTasks("tasks");

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask( "default", [ "jshint", "nodeunit" ] );

};
