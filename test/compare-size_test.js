var grunt = require("grunt"),
    file = require("fs"),
    path = require("path"),
    rdelta = /^(\S+).+?\((.+?)\).+?\s+(.*)$/,
    files = [ "dist/source.js", "dist/source.min.js", "dist/source.min.js.gz" ],
    sizecache = "./dist/.sizecache.json",
    harness = "./harness/harness.js",
    overwritten = {},
    cacheEntry = {};

function configureHarness() {
  grunt.file.write( harness, "module.exports = function( grunt ) {\n" +
    Array.prototype.join.call( arguments, "\n" ) +
  "\n};" );
}

function augmentCache( key, head, cache ) {
  var newEntry = {};
  cache = cache || { "": { tips: {} } };
  Object.keys( cacheEntry ).forEach(function( file ) {
    newEntry[ file ] = cacheEntry[ file ];
  });
  cache[ key ] = newEntry;
  if ( head ) {
    cache[""].tips[ key ] = head;
  }
  return cache;
}

function testTask( test, task, args, success, failure ) {
  grunt.utils.spawn({ cmd: "grunt", args: [ task ].concat( args || [] ) }, function( err, result ) {
    console.log( "\n\nOUTPUT:\n" + result );
    if ( !err ) {
      success( result );
    } else if ( failure ) {
      failure( err );
    } else {
      test.ok( false, "Error: " + err );
      test.done();
    }
  });
}

function testCompare( test, beforeCache, args, standardTests, success ) {
  if ( beforeCache == null ) {
    if ( path.existsSync( sizecache ) ) {
      file.unlinkSync( sizecache );
    }
  } else {
    grunt.file.write( sizecache, JSON.stringify( beforeCache ) );
  }

  testTask( test, "compare_size", args, function( result ) {
    var expectedSizes,
        lines = result.toString().split("\n").map(function( line ) { return line.trim(); }),
        cache = grunt.file.readJSON( sizecache ),
        labels = Object.keys( cache || {} ).filter(function( key ) { return key !== ""; }),
        headers = lines.filter(function( line ) { return (/^Sizes/).test( line ); });

    // Conditional sanity checks for cache/output consistency
    if ( standardTests ) {
      // Every non-privileged label should have an output header followed by the list of files with correct sizes
      expectedSizes = Object.keys( cacheEntry ).map(function( file ) { return cacheEntry[ file ]; });
      Object.keys( beforeCache || {} ).forEach(function( label ) {
        if ( label ) {
          var seek = "Sizes - compared to " + label.replace( /^ /, "" ),
              index = lines.indexOf( label in beforeCache[""].tips ?
                headers.filter(function( header ) {
                  return ( new RegExp( "^Sizes - compared to " + label + " " ) ).test( header );
                })[ 0 ] :
                seek ),
              detail = lines.slice( index + 1, index + 1 + files.length ),
              detailSizes = [],
              detailDeltas = [],
              detailFiles = [],
              cacheDeltas = [];

          detail.forEach(function( line ) {
            var match = rdelta.exec( line ) || [],
                file = match[ 3 ];
            detailFiles.push( file );
            detailSizes.push( match[1] );
            detailDeltas.push( match[2] );
          });

          files.forEach(function( file ) {
            var sizeBefore = ( ( beforeCache || {} )[ label ] || {} )[ file ],
                delta = cacheEntry[ file ] - ( sizeBefore || NaN ) || "-";
            cacheDeltas.push( delta > 0 ? "+" + delta : delta );
          });

          test.ok( index >= 0, seek );
          test.deepEqual( detailFiles, files, label + ": all files appear" );
          test.deepEqual( detailSizes, expectedSizes, label + ": all sizes correct" );
          test.deepEqual( detailDeltas, cacheDeltas, label + ": all deltas match cache" );
          test.ok( !lines[ index + 1 + files.length ], label + ": no unexpected files" );
        }
      });

      // Cache tests
      test.equal( typeof cache, "object", "Size cache exists" );
      test.equal( typeof cache[""], "object", "Size cache has metadata" );
      test.equal( typeof cache[""].tips, "object", "Size cache identifies branch tips" );
      test.deepEqual( cache[" last run"], cacheEntry, "Size cache includes 'last' data" );
    }

    success( lines, cache, {
      headers: headers,
      saves: lines.filter(function( line ) { return (/^Saved at: /).test( line ); })
    } );
  });
}

module.exports["compare_size"] = {
  "setup": function( test ) {
    // Store about-to-be-overwritten data
    [ sizecache, harness ].forEach(function( old ) {
      overwritten[ old ] = path.existsSync( old ) ? grunt.file.read( old ) : undefined;
    });

    // Get file sizes for later comparison
    files.forEach(function( file ) {
      cacheEntry[ file ] = path.existsSync( file ) ? grunt.file.read( file ).length : 0;
    });
    cacheEntry[ files[2] ] = cacheEntry[ files[2] ] || grunt.helper( "gzip", grunt.file.read( files[1] ) ).length;

    test.done();
  },

  "off-tip/working-changes, old-format cache": function( test ) {
    function next() {
      if ( harnesses.length ) {
        configureHarness( harnesses.shift() );
        testCompare( test, cacheEntry, [], false, check );
      } else {
        test.done();
      }
    }

    function check( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, ["Sizes - compared to last run"], "Cache interpreted as last run" );
      test.ok( !(/^Saved/).test( lines[ lines.length - 1 ] ), "Only saved to last run" );

      // cache tests
      test.deepEqual( cache[""].tips, {}, "No recorded branch tips" );
      test.deepEqual( cache, augmentCache(" last run"), "No unexpected data" );

      next();
    }

    var harnesses = [
      // off-tip
      'grunt.registerHelper( "git_status", function( done ) { done("branch not found"); });',
      // working-changes
      'grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "wip", head: "deadbeef", changed: true }); });'
    ];

    next();
  },

  "off-tip/working-changes, no cache": function( test ) {
    function next() {
      if ( harnesses.length ) {
        configureHarness( harnesses.shift() );
	testCompare( test, undefined, [], true, check );
      } else {
        test.done();
      }
    }

    function check( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, ["Sizes"], "Output has no comparison target" );
      test.ok( !(/^Saved/).test( lines[ lines.length - 1 ] ), "Only saved to last run" );

      // cache tests
      test.deepEqual( cache[""].tips, {}, "No recorded branch tips" );
      test.deepEqual( cache, augmentCache(" last run"), "No unexpected data" );

      next();
    }

    var harnesses = [
      // off-tip
      'grunt.registerHelper( "git_status", function( done ) { done("branch not found"); });',
      // working-changes
      'grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "wip", head: "deadbeef", changed: true }); });'
    ];

    next();
  },

  "off-tip/working-changes, zero cache": function( test ) {
    function next() {
      if ( harnesses.length ) {
        configureHarness( harnesses.shift() );
        testCompare( test, base, [], true, check );
      } else {
        test.done();
      }
    }

    function check( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, ["Sizes - compared to zeroes"], "Sizes compare to correct target" );
      test.ok( !(/^Saved/).test( lines[ lines.length - 1 ] ), "Only saved to last run" );

      // cache tests
      test.deepEqual( cache[""].tips, {}, "No recorded branch tips" );
      test.deepEqual( cache, expected, "No unexpected data" );

      next();
    }

    var base = augmentCache("zeroes"),
        expected = augmentCache( " last run", false, augmentCache("zeroes") ),
        harnesses = [
          // off-tip
          'grunt.registerHelper( "git_status", function( done ) { done("branch not found"); });',
          // working-changes
          'grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "wip", head: "deadbeef", changed: true }); });'
        ];

    Object.keys( cacheEntry ).forEach(function( file ) {
      base["zeroes"][ file ] = expected["zeroes"][ file ] = 0;
    });

    next();
  },

  "off-tip/working-changes, hash cache": function( test ) {
    function next() {
      if ( harnesses.length ) {
        configureHarness( harnesses.shift() );
        testCompare( test, base, [], true, check );
      } else {
        test.done();
      }
    }

    function check( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, [
        detail.headers.filter(function( header ) { return (/branch.*@ tip/).test( header ); })[ 0 ],
        "Sizes - compared to zeroes",
        "Sizes - compared to ones",
        "Sizes - compared to last run",
      ], "Sizes compare to correct targets" );
      detail.headers.forEach(function( header ) {
        var index = lines.indexOf( header ),
            deltas = lines.slice( index + 1, index + 4 ).map(function( line ) {
              return ( rdelta.exec( line ) || [] )[ 2 ];
            });
        test.deepEqual( deltas,
          (/last run/).test( header ) ?
            [ "-1", "-", "+1" ] :
          (/ones/).test( header ) ?
            [ -1, -1, -1 ] :
          [ "-", "-", "-" ],
          header.replace( /Sizes - compared to ([a-z ]+[a-z])/, "$1" ) + ": correct deltas"
        );
      });
      test.ok( !(/^Saved/).test( lines[ lines.length - 1 ] ), "Only saved to last run" );

      // cache tests
      test.deepEqual( cache[""].tips, { branch: "tip" }, "Branch tips unchanged" );
      test.deepEqual( cache, expected, "No unexpected data" );

      next();
    }

    var
        base = augmentCache( "branch", "tip",
          augmentCache(" last run", false,
            augmentCache( "ones", false, augmentCache("zeroes") )
          )
        ),
        expected = augmentCache( "branch", "tip",
          augmentCache(" last run", false,
            augmentCache( "ones", false, augmentCache("zeroes") )
          )
        ),
        harnesses = [
          // off-tip
          'grunt.registerHelper( "git_status", function( done ) { done("branch not found"); });',
          // working-changes
          'grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "wip", head: "deadbeef", changed: true }); });'
        ];

    Object.keys( cacheEntry ).forEach(function( file, index ) {
      base["zeroes"][ file ] = expected["zeroes"][ file ] = 0;
      base["ones"][ file ] = expected["ones"][ file ] = cacheEntry[ file ] + 1;
      base[" last run"][ file ] = cacheEntry[ file ] - index + 1;
    });

    next();
  },

  "at-tip, old-format cache": function( test ) {
    configureHarness('grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "branch", head: "tip", changed: false }); });');
    testCompare( test, cacheEntry, [], false, function( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, ["Sizes - compared to last run"], "Cache interpreted as last run" );
      test.equal( lines[ lines.length - 1 ], "Saved as: branch", "Saved to branch label" );

      // cache tests
      test.deepEqual( cache[""].tips, { branch: "tip" }, "New tip saved" );
      test.deepEqual( cache.branch, cacheEntry, "Sizes updated for active branch" );
      test.deepEqual( cache, augmentCache( "branch", "tip", augmentCache(" last run") ), "No unexpected data" );

      test.done();
    });
  },

  "at-tip, no cache": function( test ) {
    var expected = augmentCache( " last run", false, augmentCache( "branch", "tip" ) );

    configureHarness('grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "branch", head: "tip", changed: false }); });');
    testCompare( test, undefined, [], true, function( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, ["Sizes"], "Output has no comparison target" );
      test.equal( lines[ lines.length - 1 ], "Saved as: branch", "Saved to branch label" );

      // cache tests
      test.deepEqual( cache[""].tips, { branch: "tip" }, "New tip saved" );
      test.deepEqual( cache.branch, cacheEntry, "Sizes updated for active branch" );
      test.deepEqual( cache, expected, "No unexpected data" );

      test.done();
    });
  },

  "at-tip, zero cache": function( test ) {
    var base = augmentCache( "zeroes", "old-tip" ),
        expected = augmentCache( " last run", false, augmentCache( "zeroes", "new-tip" ) );

    Object.keys( cacheEntry ).forEach(function( file ) {
      base["zeroes"][ file ] = 0;
    });

    configureHarness('grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "zeroes", head: "new-tip", changed: false }); });');
    testCompare( test, base, [], true, function( lines, cache, detail ) {
      // output tests
      test.ok( (/zeroes.*@ old-tip/).test( detail.headers[ 0 ] ), "Sizes compare to correct target" );
      test.equal( detail.headers.length, 1, "No unexpected targets" );
      test.deepEqual(
        lines.map(function( line ) { return ( rdelta.exec( line ) || [] )[ 2 ]; })
          .filter(function( delta ) { return !!delta; }),
        [ "-", "-", "-" ],
        "Correct deltas"
      );
      test.equal( lines[ lines.length - 1 ], "Saved as: zeroes", "Saved to branch label" );

      // cache tests
      test.deepEqual( cache[""].tips, { zeroes: "new-tip" }, "New tip saved" );
      test.deepEqual( cache.zeroes, cacheEntry, "Sizes updated for active branch" );
      test.deepEqual( cache, expected, "No unexpected data" );

      test.done();
    });
  },

  "at-tip, hash cache": function( test ) {
    var
        base = augmentCache( "stale", "tip",
          augmentCache(" last run", false,
            augmentCache( "ones", "old-tip", augmentCache("zeroes") )
          )
        ),
        expected = augmentCache( "stale", "tip",
          augmentCache(" last run", false,
            augmentCache( "ones", "new-tip", augmentCache("zeroes") )
          )
        );

    Object.keys( cacheEntry ).forEach(function( file, index ) {
      base["stale"][ file ] = expected["stale"][ file ] = cacheEntry[ file ] + 1;
      base["zeroes"][ file ] = expected["zeroes"][ file ] = 0;
      base["ones"][ file ] = cacheEntry[ file ] + 1;
      base[" last run"][ file ] = cacheEntry[ file ] - index + 1;
    });

    configureHarness('grunt.registerHelper( "git_status", function( done ) { done( null, { branch: "ones", head: "new-tip", changed: false }); });');
    testCompare( test, base, [], true, function( lines, cache, detail ) {
      // output tests
      test.deepEqual( detail.headers, [
        detail.headers.filter(function( header ) { return (/ones.*@ old-tip/).test( header ); })[ 0 ],
        detail.headers.filter(function( header ) { return (/stale.*@ tip/).test( header ); })[ 0 ],
        "Sizes - compared to zeroes",
        "Sizes - compared to last run",
      ], "Sizes compare to correct targets" );
      detail.headers.forEach(function( header ) {
        var index = lines.indexOf( header ),
            deltas = lines.slice( index + 1, index + 4 ).map(function( line ) {
              return ( rdelta.exec( line ) || [] )[ 2 ];
            });
        test.deepEqual( deltas,
          (/last run/).test( header ) ?
            [ "-1", "-", "+1" ] :
          (/ones|stale/).test( header ) ?
            [ -1, -1, -1 ] :
          [ "-", "-", "-" ],
          header.replace( /Sizes - compared to ([a-z ]+[a-z])/, "$1" ) + ": correct deltas"
        );
      });
      test.equal( lines[ lines.length - 1 ], "Saved as: ones", "Saved to branch label" );

      // cache tests
      test.deepEqual( cache[""].tips, { stale: "tip", ones: "new-tip" }, "New tip saved" );
      test.deepEqual( cache.ones, cacheEntry, "Sizes updated for active branch" );
      test.deepEqual( cache.stale, expected.stale, "Sizes not updated for inactive branch" );
      test.deepEqual( cache, expected, "No unexpected data" );

      test.done();
    });
  },

  "list": function( test ) {
    var cache = augmentCache( "label", false, augmentCache( "branch", "tip", augmentCache(" last run") ) );

    grunt.file.write( sizecache, JSON.stringify( cache ) );
    testTask( test, "compare_size_list", [], function( result ) {
      var lines = result.toString().split("\n").map(function( line ) { return line.trim(); }),
          index = lines.indexOf("label");

      // output tests
      test.ok( (/^branch.*@ tip/).test( lines[ index - 1 ] ), "Found branch with correct tip" );
      test.ok( index >= 0, "Found custom label" );
      test.ok( !lines[ index + 1 ], "Last run not listed" );

      // cache tests
      test.deepEqual( JSON.parse( grunt.file.read( sizecache ) ), cache, "Size cache untouched" );

      test.done();
    });
  },

  "add, old-format cache": function( test ) {
    grunt.file.write( sizecache, JSON.stringify( cacheEntry ) );
    testTask( test, "compare_size_add:custom", [], function( result ) {
      var lines = result.toString().split("\n").map(function( line ) { return line.trim(); }),
          cache = grunt.file.readJSON( sizecache ),
          index = lines.indexOf("Last run saved as: custom");

      // output tests
      test.ok( index >= 0, "Added with correct label" );
      test.ok( !(/^Last run saved/).test( lines[ index - 1 ] ), "No unexpected adds before" );
      test.ok( !lines[ index + 1 ], "No unexpected adds after" );

      // cache tests
      test.deepEqual( cache[""].tips, {}, "No recorded branch tips" );
      test.deepEqual( cache[" last run"], cacheEntry, "Last run unchanged" );
      test.deepEqual( cache["custom"], cacheEntry, "Custom data stored" );
      test.deepEqual( cache, augmentCache( "custom", false, augmentCache(" last run") ), "No unexpected data" );

      test.done();
    });
  },

  "add, no cache": function( test ) {
    file.unlinkSync( sizecache );
    testTask( test, "compare_size_add:custom", [], function() {
      test.ok( false, "Error expected" );
    }, function( err ) {
      // output tests
      test.ok( (/No size data found/).test( err.stdout ), "Error found" );

      // cache tests
      test.ok( !path.existsSync( sizecache ), "Cache not created" );

      test.done();
    });
  },

  "add, hash cache": function( test ) {
    grunt.file.write( sizecache, JSON.stringify(
      augmentCache( "branch", "tip", augmentCache( "replaced", "tip", augmentCache(" last run") ) ) )
    );
    testTask( test, "compare_size_add:custom:replaced", [], function( result ) {
      var lines = result.toString().split("\n").map(function( line ) { return line.trim(); }),
          cache = grunt.file.readJSON( sizecache ),
          index = lines.indexOf("Last run saved as: custom");

      // output tests
      test.ok( index >= 0, "First label" );
      test.equal( lines[ index + 1 ], "(removed branch data) Last run saved as: replaced", "Second label" );
      test.ok( !(/^Last run saved/).test( lines[ index - 1 ] ), "No unexpected adds before" );
      test.ok( !lines[ index + 2 ], "No unexpected adds after" );

      // cache tests
      test.deepEqual( cache[""].tips, { branch: "tip" }, "Removed branch data" );
      test.deepEqual( cache[" last run"], cacheEntry, "Last run unchanged" );
      test.deepEqual( cache["custom"], cacheEntry, "Custom data stored" );
      test.deepEqual( cache["replaced"], cacheEntry, "Replaced data stored" );
      test.deepEqual( cache, augmentCache( "custom", false,
        augmentCache( "branch", "tip", augmentCache( "replaced", false, augmentCache(" last run") ) ) ),
        "No unexpected data" );

      test.done();
    });
  },

  "remove": function( test ) {
    grunt.file.write( sizecache, JSON.stringify(
      augmentCache( "branch", "tip", augmentCache( "removed", "tip", augmentCache(" last run") ) ) )
    );
    testTask( test, "compare_size_remove:removed", [], function( result ) {
      var lines = result.toString().split("\n").map(function( line ) { return line.trim(); }),
          cache = grunt.file.readJSON( sizecache ),
          index = lines.indexOf("Removed: removed");

      // output tests
      test.ok( index >= 0, "Removed label" );
      test.ok( !(/^Last run saved/).test( lines[ index - 1 ] ), "No unexpected removes before" );
      test.ok( !lines[ index + 1 ], "No unexpected removes after" );

      // cache tests
      test.deepEqual( cache[""].tips, { branch: "tip" }, "No recorded branch tips" );
      test.deepEqual( cache[" last run"], cacheEntry, "Last run unchanged" );
      test.deepEqual( cache["branch"], cacheEntry, "Branch data retained" );
      test.ok( !( "removed" in cache ), "Data removed" );
      test.deepEqual( cache, augmentCache( "branch", "tip", augmentCache(" last run") ),
        "No unexpected data" );

      test.done();
    });
  },

  "clear": function( test ) {
    grunt.file.write( sizecache, JSON.stringify(
      augmentCache( "branch", "tip", augmentCache( "removed", "tip", augmentCache(" last run") ) ) )
    );
    testTask( test, "compare_size_empty", [], function( result ) {
      // cache tests
      test.ok( !path.existsSync( sizecache ), "Size cache removed" );

      test.done();
    });
  },

  "teardown": function( test ) {
    // Restore overwritten data
    Object.keys( overwritten ).forEach(function( old ) {
      if ( overwritten[ old ] == null ) {
        if ( path.existsSync( old ) ) {
          file.unlinkSync( old );
        }
      } else {
        grunt.file.write( old, overwritten[ old ] );
      }
    });

    test.done();
  }
};

// ./node_modules/.bin/grunt test
