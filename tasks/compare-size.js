/*
 * grunt-compare-size
 * https://github.com/rwldrn/grunt-compare-size
 *
 * Copyright (c) 2012 Rick Waldron <waldron.rick@gmail.com> &
 *                     Richard Gibson <richard.gibson@gmail.com> &
 *                      Corey Frang <gnarf@gnarf.net>
 * Licensed under the MIT license.
 */

var path = require("path"),
    fs = require("fs");

module.exports = function(grunt) {
  // Grunt utilities.
  var task = grunt.task;
  var file = grunt.file;
  var utils = grunt.utils;
  var log = grunt.log;
  var verbose = grunt.verbose;
  var fail = grunt.fail;
  var option = grunt.option;
  var config = grunt.config;
  var template = grunt.template;
  var sizecache = "dist/.sizecache.json";
  var lastrun = " last run";

  // Compare size to saved sizes
  // Derived and adapted from Corey Frang's original `sizer`
  grunt.registerTask( "compare_size", "Compare working size to saved sizes", function() {
    var done = this.async(),
        newsizes = grunt.helper( "sizes", this ),
        files = Object.keys( newsizes ),
        cache = grunt.helper( "get_cache", sizecache ),
        tips = cache[""].tips,
        labels = grunt.helper( "sorted_labels", cache );

    // Obtain the current branch and continue...
    grunt.helper( "git_status", function( err, status ) {
      if ( err ) {
        log.error( err );
        status = {};
      }

      labels.forEach(function( label, index ) {
        var key, diff, color,
            oldsizes = cache[ label ];

        // Skip metadata key
        if ( label === "" ) {
          return;
        }

        // Output header line
        log.write(
          !oldsizes ?
            "Sizes" :
            "Sizes - compared to " +
            ( label[0] === " " ?
              label.slice( 1 ) :
              label )
        );

        if ( label in tips ) {
          log.write( " " + ( "@ " + tips[ label ] )[ "grey" ] );
        }
        log.writeln("");

        // Output size comparisons
        for ( key in newsizes ) {
          diff = oldsizes && oldsizes[ key ] && ( newsizes[ key ] - oldsizes[ key ] );

          if ( diff < 0 ) {
            color = "green";
          } else if ( diff > 0 ) {
            diff = "+" + diff;
            color = "red";
          } else {
            diff = "-";
            color = "grey";
          }

          log.writetableln([ 12, 12, 55 ], [
            utils._.lpad( newsizes[ key ], 10 ) ,
            utils._.lpad( "(" + diff + ")", 10 )[ color ],
            key
          ]);
        }

        // Output blank line for following comparisons
        if ( labels.length > index + 1 ) {
          log.writeln("");
        }
      });

      // Update "last run" sizes
      cache[ lastrun ] = newsizes;

      // Remember if we're at a branch tip and the branch name is an available key
      if ( status.branch && !status.changed && ( status.branch in tips || !cache[ status.branch ] ) ) {
        tips[ status.branch ] = status.head;
        cache[ status.branch ] = newsizes;
        log.writeln( "\nSaved as: " + status.branch );
      }

      // Write to file
      file.write( sizecache, JSON.stringify( cache ) );
    });

    // Fail task if errors were logged.
    if ( this.errorCount ) {
      return false;
    }
  });

  // List saved sizes
  grunt.registerTask( "compare_size_list", "List saved sizes", function() {
    var cache = grunt.helper( "get_cache", sizecache ),
        tips = cache[""].tips;

    grunt.helper( "sorted_labels", cache ).forEach(function( label ) {
      // Skip the special labels
      if ( label && label.charAt( 0 ) !== " " ) {
        log.write( label );
        if ( label in tips ) {
          log.write( " " + ( "@ " + tips[ label ] )[ "grey" ] );
        }
        log.writeln("");
      }
    });
  });

  // Add custom label
  grunt.registerTask( "compare_size_add", "Add to saved sizes", function() {
    var label,
        cache = grunt.helper( "get_cache", sizecache );

    if ( !cache[ lastrun ] ) {
      log.error("No size data found");
      return false;
    }

    // Store last run sizes under each label, clearing them as branch heads
    for ( label in this.flags ) {
      if ( label in cache[""].tips ) {
        delete cache[""].tips[ label ];
        log.write("(removed branch data) ");
      }
      cache[ label ] = cache[ lastrun ];
      log.writeln( "Last run saved as: " + label );
    }

    file.write( sizecache, JSON.stringify( cache ) );
  });

  // Remove custom label
  grunt.registerTask( "compare_size_remove", "Remove from saved sizes", function() {
    var label,
        cache = grunt.helper( "get_cache", sizecache );

    for ( label in this.flags ) {
      delete cache[""].tips[ label ];
      delete cache[ label ];
      log.writeln( "Removed: " + label );
    }

    file.write( sizecache, JSON.stringify( cache ) );
  });

  // Empty size cache
  grunt.registerTask( "compare_size_empty", "Clear all saved sizes", function() {
    if ( path.existsSync( sizecache ) ) {
      fs.unlinkSync( sizecache );
    }
  });

  // Label sequence helper
  grunt.registerHelper( "sorted_labels", function( cache ) {
    var tips = cache[""].tips;

    // Sort labels: metadata, then branch tips by first add,
    // then user entries by first add, then last run
    // Then return without metadata
    return Object.keys( cache ).sort(function( a, b ) {
      var keys = Object.keys( cache );

      return ( a ? 1 : 0 ) - ( b ? 1 : 0 ) ||
        ( a in tips ? 0 : 1 ) - ( b in tips ? 0 : 1 ) ||
        ( a.charAt(0) === " " ? 1 : 0 ) - ( b.charAt(0) === " " ? 1 : 0 ) ||
        keys.indexOf( a ) - keys.indexOf( b );
    }).slice( 1 );
  });

  // Size cache helper
  grunt.registerHelper( "get_cache", function( src ) {
    var cache;

    try {
      cache = file.readJSON( src );
    } catch ( e ) {
      verbose.error( e );
    }

    // Progressively upgrade `cache`, which is one of:
    // empty
    // {}
    // { file: size [,...] }
    // { "": { file: size [,...] } [,...] }
    if ( typeof cache !== "object" ) {
      cache = undefined;
    }
    if ( !cache || !cache[""] ) {
      // If promoting to dictionary, assume that data are for last run
      cache = { "": { tips: {} }, " last run": cache };
    }

    return cache;
  });

  // Files helper.
  grunt.registerHelper( "sizes", function( task ) {
    task.requiresConfig( task.name );

    var files = file.expandFiles( grunt.config( task.name ).files ),
        sizes = {};

    files.forEach(function( src, index ) {
      var contents = file.read( src );
      sizes[ src ] = contents.length;
      if ( index === ( files.length - 1 ) ) {
        sizes[ src + ".gz" ] = grunt.helper( "gzip", contents ).length;
      }
    });

    return sizes;
  });

  // git helper.
  grunt.registerHelper( "git_status", function( done ) {
    verbose.write( "Running `git branch` command..." );
    utils.spawn({
      cmd: "git",
      args: [
        "branch", "--no-color", "--verbose", "--no-abbrev", "--contains",
        "HEAD"
      ]
    }, function( err, result ) {
      var status, matches;

      if ( err ) {
        verbose.error();
        done( err );
        return;
      }

      status = {};
      matches = /^\* (\S+)\s+([0-9a-f]+)/im.exec( result );

      if ( !matches ) {
        verbose.error();
        done("branch not found");
      } else {
        status.branch = matches[ 1 ];
        status.head = matches[ 2 ];
        utils.spawn({
          cmd: "git",
          args: [
            "diff", "--quiet", "HEAD"
          ]
        }, function( err, result, code ) {
          status.changed = code !== 0;
          done( null, status );
        });
      }
    });
  });

  // Load test harness, if there is one
  // A hack, but we can't drop it into tasks/ because loadTasks might evaluate the harness first
  if ( path.existsSync("harness") ) {
    grunt.loadTasks("harness");
  }
};
