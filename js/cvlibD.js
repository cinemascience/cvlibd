'use strict';
(function() {
	/**
	 * CVLIBD
	 * A framework for establishing the relationship between the Sources, Displays and Structures
	 * of a Cinema SpecD v2 Database. Contains the classes Database, Source, Display, Input Structure
	 * and Output Structure. An Instance of Database is created from a reference to a SpecD v2 JSON file
	 * and creates all of its Sources, Displays and Structures and connects them according to the JSON.
	 * 
	 * @exports CVLIBD
	 * 
	 * @author Cameron Tauxe
	 * @version 1.0
	 * 
	 * TODO:
	 * Once there is an official version of the spec, add verfication to ensure
	 * that a JSON obeys the spec upon loading.
	 */
	var CVLIBD = {};
	if (!window.CVLIBD) window.CVLIBD = CVLIBD;

	/*****************************************
	 * DATABASE
	 *****************************************/

	/**
	 * Database
	 * Creates a new instance of Database which represents the whole of a single SpecD v2 Database.
	 * 
	 * @constructor
	 * @param {string} url - path to JSON file
	 * @param {function} callback - Called once the database has finsihed loading with a reference to this database
	 */
	CVLIBD.Database = function(url, callback) {
		//Get the path of the directory the JSON resides in
		this.directory = (url.match(/(.*)[\/\\]/)[1]+'/')||'';
		
		//Load JSON
		var self = this;
		CVLIBD.loadJSON(url, function(result) {
			var errors = CVLIBD.verifyJSON(result);
			if (errors)
				console.log("There are errors present in the JSON."+
						" Some things may work unexpectedly or not at all.");

			/** @type {Object} - An Object of the JSON used to generate this database.*/
			self.json = result;

			/** @type {Object} - The contents of the "cinema" section of the Database's JSON*/
			self.info = self.json.cinema;

			/** @type {Object} - A dictionary of all the sources of this database (uses same keys as in JSON)*/
			self.sources = {};
			for (var key in self.json.sources) {
				self.sources[key] = new CVLIBD.Source(key,self.json.sources[key],self);
			}

			/** @type {Object} - A dictionary of all the displays of this database (uses same keys as in JSON)*/
			self.displays = {};
			for (var key in self.json.displays) {
				self.displays[key] = new CVLIBD.Display(key,self.json.displays[key],self);
			}

			if (callback)
				callback(self);
		});
	};

	/**
	 * Add the given builder function (or functions) to the list of builders to
	 * every structure in this database.
	 * @param {function[]|function} builders - The list of builders (a single builder to add)
	 */
	CVLIBD.Database.prototype.addBuildersToAll = function(builders) {
		if (builders.constructor === Array)
			for (var i in this.displays)
				for (var j in this.displays[i].structures)
					for (var b in builders)
						this.displays[i].structures[j].builders.push(builders.b);
		else
			for (var i in this.displays)
				for (var j in this.displays[i].structures)
					this.displays[i].structures[j].builders.push(builders);
	}

	/**
	 * Set every source in this database to use the given function as its loader
	 * @param {function} loader - The loader to use
	 */
	CVLIBD.Database.prototype.setLoadersForAll = function(loader) {
		for (var i in this.sources)
			this.sources[i].loader = loader;
	};

	/*****************************************
	 * SOURCE
	 *****************************************/

	/**
	 * Source
	 * Creates a new instance of Source which represents a single source of a SpecD v2 Database
	 * 
	 * @constructor
	 * @param {string} id - The key value of this source in the JSON
	 * @param {Object} json - The object of the JSON that this source represents.
	 * @param {CVLIBD.Database} - A reference to the database that this source is a part of
	 */
	CVLIBD.Source = function(id, json, database) {
		/** @type {string} The key used to refer to this source */
		this.id = id;
		/** @type {Object} A reference to the database that this source is a part of */
		this.db = database;

		/** @type {Object} Contains information about the source.
		 * uri - The path to the source file (corrected to be relative to the webpage)
		 * table - The value of 'table' in the source's JSON
		 * mime - The value of 'mime' in the source's JSON
		 */
		this.info = {};
		this.info.uri = this.db.directory + json.uri;
		this.info.table = json.table;
		this.info.mime = json.mime;

		/** @type {Object[]} An array for the source's data once loaded */
		this.data = [];

		/** @type {function} The function used to load data for this source.
		 * Must be set either manually or through the Database.SetLoadersForAll function
		 */
		this.loader = undefined;
	}

	/**
	 * Load data from this source's file into the data array by calling
	 * a loader function.
	 * @param {function} loader - The loader function to call, 
	 * If undefined, data will be loaded using the function referenced in the source's 'loader' field.
	 * @param {function} callback - Function to be called once loading has finished.
	 */
	CVLIBD.Source.prototype.load = function(loader, callback) {
		if (loader)
			loader.call(this, callback);
		else if (this.loader)
			this.loader.call(this, callback);
		else {
			console.log("No loader set for source " + this.id + "!");
			callback();
		}
	}

	/*****************************************
	 * DISPLAY
	 *****************************************/

	/**
	 * Display
	 * Create an instance of Display, which represents a sinlge display in SpecD v2 database.
	 * 
	 * @constructor
	 * @param {string} id - The key value of this display in the JSON
	 * @param {Object} json - The object of the JSON that this display represents.
	 * @param {CVLIBD.Database} - A reference to the database that this display is a part of 
	 */
	CVLIBD.Display = function(id, json, database) {
		/** @type {string} The key value of this display */
		this.id = id;
		/** @type {string} The user-friendly external name used to refer to this display */
		this.label = json.label;
		/** @type {CVLIBD.Database} A reference to the database that this display is a part of */
		this.db = database;
		
		/** @type {CVLIBD.Source} A reference to the source that this display is linked to */
		this.source = this.db.sources[json.source];
		if (!this.source)
			console.log("Source " + json.source + " for display " + id + " was not found in sources.");
		
		/** @type {Object} A dictionary of all of the structures for this display */
		this.structures = {};
		/** @type {Object} A dictionary of just the structures marked as inputs */
		this.inputs = {};
		/** @type {Object} A dictionary of just the structures marked as outputs */
		this.outputs = {};

		//Instantiate structures
		var self = this;
		for (var key in json.structures) {
			var structJson = json.structures[key];
			if (structJson.io == 'input')
				self.structures[key] = self.inputs[key] = new CVLIBD.InputStructure(key,structJson,this,this.db);
			else if (structJson.io == 'output')
				self.structures[key] = self.outputs[key] = new CVLIBD.OutputStructure(key,structJson,this,this.db);
			else
				console.log("Structure " + key + " has improper io value. io must be 'input' or 'output'.");
		}
		
	}

	/**
	 * Called whenever one of this display's input structures changes its query.
	 * Updates the set of data to be displayed accordingly and sets the query for all output structures.
	 */
	CVLIBD.Display.prototype.updateInput = function() {
		var intersection = [];
		var self = this;
		for (var i in this.source.data) {
			var d = this.source.data[i];
			var inAll = true;
			for (var key in this.inputs) {
				inAll = inAll && this.inputs[key].query.includes(d);
			}
			if (inAll)
				intersection.push(d);
		}
		for (var key in this.outputs) {
			var output = this.outputs[key];
			output.query = intersection;
			output.update();
		}
	}

	/**
	 * Loads this display's source and builds all structures once loading has finished.
	 */
	CVLIBD.Display.prototype.activate = function() {
		var self = this;
		this.source.load(undefined,function() {
			for (var key in self.structures)
				self.structures[key].build();
			self.updateInput();
		});
	};

	/*****************************************
	 * STRUCTURE
	 *****************************************/

	/**
	 * Structure
	 * 
	 * An abstract constructor used by either InputStructure or OutputStructure.
	 * Represents a single structure of a SpecD v2 Database
	 * 
	 * @constructor
	 * @abstract
	 * @param {string} id - The key value of this structure in the JSON
	 * @param {json} json - The object of the JSON that this structure represents
	 * @param {CVLIBD.Display} display - A reference to the display that this structure is a part of
	 * @param {CVLIBD.Database} database - A reference to the database that this structure is a part of
	 */
	CVLIBD.Structure = function(id, json, display, database) {
		if (this.constructor === CVLIBD.Structure)
			throw new Error("Cannot instantiate abstract class 'Structure.'"+
								" Please use a subclass, 'InputStructure' or 'OutputStructure.'");

		/** @type {string} The key value of this structure */
		this.id = id;
		/** @type {CVLIBD.Database} A reference to the database that this structure is a part of */
		this.db = database;

		/** @type {Object} Contains meta information about the structure
		 * type - the type of the structure (as defined in JSON)
		 * label - The user-friendly external name of this structure (as defined in JSON)
		 * io - either 'input' or 'output' (defined in JSON)
		 * arguments - The contents of 'arguments' defined in JSON
		 */
		this.info = {};
		this.info.type = json.type;
		this.info.label = json.label;
		this.info.io = json.io;
		this.info.arguments = json.arguments;

		/** @type {CVLIBD.Display} A reference to the display that this structure is a part of */
		this.display = display;
		/** @type {CVLIBD.Source} A reference to the source that this structure gets data from */
		this.source = this.display.source;

		/** @type {Object[]}
		 * If input: An array of the data objects that this input has selected
		 * If output: An array of the data objects that this output should display
		 */
		this.query = [];

		/** @type {function[]} An array of the functions to be called to build the content of this structure */
		this.builders = [];

		/** @type {DOM} A DOM Element to represent this structure on the page */
		this.content = document.createElement("span");
		this.content.setAttribute("id",this.id);
		this.content.setAttribute("class","cvlibD_structure")
		this.content.setAttribute("type",this.info.type);
		this.content.setAttribute("io",this.info.io);
	}

	/**
	 * Create the contents of this structure by calling a series of builder functions.
	 * The current content of the structure will be cleared first.
	 * @param {function} builder Builder function to call,
	 * if undefined, will call each function in the structures 'builders' array sequentially.
	 */
	CVLIBD.Structure.prototype.build = function(builder) {
		if (builder) {
			this.content.innerHTML = '';
			builder.call(this);
		}
		else if (this.builders.length == 0)
			console.log("No builders set for structure " + this.id + "!");
		else {
			this.content.innerHTML = '';
			for (var i in this.builders)
				this.builders[i].call(this);
		}
	};

	/**
	 * InputStructure
	 * Create an instance of InputStructure which represents a structure marked for use as an input
	 * @constructor
	 * @param {string} id - The key value of this structure in the JSON
	 * @param {json} json - The object of the JSON that this structure represents
	 * @param {CVLIBD.Display} display - A reference to the display that this structure is a part of
	 * @param {CVLIBD.Database} database - A reference to the database that this structure is a part of
	 */
	CVLIBD.InputStructure = function(id, json, parentDisplay, database) {
		CVLIBD.Structure.call(this, id, json, parentDisplay, database);
	};
	CVLIBD.InputStructure.prototype = Object.create(CVLIBD.Structure.prototype);
	CVLIBD.InputStructure.prototype.constructor = CVLIBD.InputStructure;

	CVLIBD.InputStructure.prototype.update = function() {
		this.display.updateInput();
	};

	/**
	 * OutputStructure
	 * Create an instance of OutputStructure which represents a structure marked for use as an output
	 * @constructor
	 * @param {string} id - The key value of this structure in the JSON
	 * @param {json} json - The object of the JSON that this structure represents
	 * @param {CVLIBD.Display} display - A reference to the display that this structure is a part of
	 * @param {CVLIBD.Database} database - A reference to the database that this structure is a part of
	 */
	CVLIBD.OutputStructure = function(id, json, parentDisplay, database) {
		CVLIBD.Structure.call(this, id, json, parentDisplay, database);
		/** @type {function[]} A series of functions to be called when this output updates */
		this.updateListeners = [];
	};
	CVLIBD.OutputStructure.prototype = Object.create(CVLIBD.Structure.prototype);
	CVLIBD.OutputStructure.prototype.constructor = CVLIBD.OutputStructure;

	/**
	 * Indicates that this outputs query has been changed and that all updateListeners should
	 * be called.
	 */
	CVLIBD.OutputStructure.prototype.update = function() {
		if (this.updateListeners.length == 0)
			console.log("No update listeners set for output structure " + this.id + "!" +
						" Did you forget to set one in the structure's builder?");
		else 
			for (var i in this.updateListeners)
				this.updateListeners[i].call(this);
	};

	/*****************************************
	 * UTIL FUNCTIONS
	 *****************************************/

	CVLIBD.loadJSON = function(url, callback) {
		var jsonRequest = new XMLHttpRequest();
		jsonRequest.open("GET",url,true);
		jsonRequest.onreadystatechange = function() {
			if (jsonRequest.readyState === 4) {
				if (jsonRequest.status === 200 || jsonRequest.status === 0) {
					callback(JSON.parse(jsonRequest.responseText));
				}
				else {
					console.log("Error retrieving JSON " + url + ". AJAX/HTTP Status: " + jsonRequest.status);
					callback(null);
				}
			}
		}
		jsonRequest.send(null);
	};

	CVLIBD.verifyJSON = function(json) {
		//TODO: Actual verification
		//Will probably wait for a final version of the specification
		return null;
	};
})();