/*
 * grunt-compare-size
 * https://github.com/rwldrn/grunt-compare-size
 *
 * Copyright (c) 2012 Rick Waldron <waldron.rick@gmail.com> &
 *                     Richard Gibson <richard.gibson@gmail.com> &
 *                      Corey Frang <gnarf@gnarf.net> &
 *                       Mike Sherov <mike.sherov@gmail.com>
 * Licensed under the MIT license.
 */

 "use strict";

var fs = require("fs"),
  gzip = require("gzip-js");

module.exports = function(grunt) {
  // Grunt utilities & task-wide assignments
  var file, utils, log, verbose, sizecache, lastrun, helpers;

  file = grunt.file;
  utils = grunt.util;
  log = grunt.log;
  verbose = grunt.verbose;
  sizecache = "dist/.sizecache.json";
  lastrun = " last run";
  helpers = {

    // Label sequence helper
    sorted_labels: function( cache ) {
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
    },

    // Size cache helper
    get_cache: function( src ) {
      var cache;

      try {
        cache = fs.existsSync( src ) ? file.readJSON( src ) : undefined;
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
        cache = utils._.object( [ "", lastrun ], [ { tips: {} }, cache ] );
      }

      return cache;
    },

    // Files helper.
    sizes: function( task ) {
      var sizes = {},
          files = file.expand(
            { filter: "isFile" },
            task.filesSrc
          );

      files.forEach(function( src, index ) {
        var contents = file.read( src );
        sizes[ src ] = contents.length;
        if ( index === ( files.length - 1 ) ) {
          sizes[ src + ".gz" ] = gzip.zip( contents, {} ).length;
        }
      });

      return sizes;
    },

    // git helper.
    git_status: function( done ) {
      verbose.write( "Running `git branch` command..." );
      utils.spawn({
        cmd: "git",
        args: [
          "branch", "--no-color", "--verbose", "--no-abbrev", "--contains",
          "HEAD"
        ]
      }, function( err, result ) {
        var status = {},
            matches = /^\* (.+?)\s+([0-9a-f]{8,})/im.exec( result );

        if ( err || !matches ) {
          verbose.error();
          done( err || "branch not found" );
        } else if ( matches[ 1 ].indexOf(" ") >= 0 ) {
          done( "not a branch tip: " + matches[ 2 ] );
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
    }
  };

  // Load test harness, if there is one
  // A hack, but we can't drop it into tasks/ because loadTasks might evaluate the harness first
  if ( fs.existsSync("./harness") ) {
    helpers.git_status = require("../harness/harness");
  }

  // Compare size to saved sizes
  // Derived and adapted from Corey Frang's original `sizer`
  grunt.registerMultiTask( "compare_size", "Compare working size to saved sizes", function() {
    var done = this.async(),
      newsizes = helpers.sizes( this ),
      cache = helpers.get_cache( sizecache ),
      tips = cache[""].tips,
      labels = helpers.sorted_labels( cache );

    // Obtain the current branch and continue...
    helpers.git_status( function( err, status ) {
      if ( err ) {
        log.warn( err );
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

      done();
    });

    // Fail task if errors were logged.
    if ( this.errorCount ) {
      return false;
    }
  });

  // List saved sizes
  grunt.registerTask( "compare_size:list", "List saved sizes", function() {
    var cache = helpers.get_cache( sizecache ),
        tips = cache[""].tips;

    helpers.sorted_labels( cache ).forEach(function( label ) {
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
  grunt.registerTask( "compare_size:add", "Add to saved sizes", function() {
    var label,
        cache = helpers.get_cache( sizecache );

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
  grunt.registerTask( "compare_size:remove", "Remove from saved sizes", function() {
    var label,
        cache = helpers.get_cache( sizecache );

    for ( label in this.flags ) {
      delete cache[""].tips[ label ];
      delete cache[ label ];
      log.writeln( "Removed: " + label );
    }

    file.write( sizecache, JSON.stringify( cache ) );
  });

  // Empty size cache
  grunt.registerTask( "compare_size:empty", "Clear all saved sizes", function() {
    if ( fs.existsSync( sizecache ) ) {
      fs.unlinkSync( sizecache );
    }
  });

  // Backwards compatibility aliases
  "list add remove empty".split(" ").forEach(function( task ) {
    grunt.registerTask( "compare_size_" + task, function() {
      grunt.task.run( [ "compare_size:" + task ].concat(
        Object.keys( this.flags )
      ).join(":") );
    });
  });
};
