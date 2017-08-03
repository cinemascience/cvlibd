'use strict';
(function() {

	/**
	 * The main SuperLoader function
	 * Defers to specific loader function depending on the source's mime type.
	 * Calls callback when done loading
	 */
	var SUPERLOADER = function(callback) {
		switch (this.info.mime) {
			case "text/csv" :
				SUPERLOADER.csvLoader.call(this, callback);
				break;
			case "text/tsv" :
				SUPERLOADER.tsvLoader.call(this,callback);
				break;
			default:
				console.log("Super Loader does not have a loader for mime type " + this.info.mime);
				callback.call(this);
		}
	};
	if (!window.SUPERLOADER) window.SUPERLOADER = SUPERLOADER;

	/**
	 * Load data from a csv file
	 */
	SUPERLOADER.csvLoader = function(callback) {
		var self = this;
		SUPERLOADER.textRequest.call(this,this.info.uri, function(text) {
			self.data = d3.csvParse(text);
			callback.call(this);
		});
	};

	/**
	 * Load data from a tsv file
	 */
	SUPERLOADER.tsvLoader = function(callback) {
		var self = this;
		SUPERLOADER.textRequest.call(this,this.info.uri, function(text) {
			self.data = d3.tsvParse(text);
			callback.call(this);
		});
	};

	/**
	 * Send an http request for the text contents of the given url,
	 * and call callback with the text as an argument when done
	 */
	SUPERLOADER.textRequest = function(url, callback) {
		var req = new XMLHttpRequest();
		req.open("GET",url,true);
		req.onreadystatechange = function() {
			if (req.readyState === 4) {
				if (req.status === 200 || req.status === 0) {
					callback.call(this,req.responseText);
				}
				else {
					console.log("Error retrieving source " + url + ". AJAX/HTTP Status: " + req.status);
					callback.call(this,"");
				}
			}
		}
		req.send(null);
	};

})();