'use strict';
/**
 * A specialized builder function for CVLIB-D
 * which provides default content for a variety of structures.
 * 
 * Author: Cameron Tauxe
 */
(function() {

	/**
	 * The main SuperBuilder function
	 * Appends a header and then defers to a more specific function
	 * depending on the type of the structure.
	 */
	var SUPERBUILDER = function() {
		d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Header')
			.text(this.info.label);

		switch (this.info.type) {
			case 'scalar':
				SUPERBUILDER.scalarBuilder.call(this);
				break;
			case 'category':
				SUPERBUILDER.categoryBuilder.call(this);
				break;
			case 'camera-orbit':
				SUPERBUILDER.camera_orbit_builder.call(this);
				break;
			case 'table':
				if (this.info.io == 'input')
					SUPERBUILDER.inputTableBuilder.call(this);
				else if (this.info.io == 'output')
					SUPERBUILDER.outputTableBuilder.call(this);
				else
					SUPERBUILDER.invalidBuilder.call(this);
				break;
			case 'image-file-format-by-ext':
				SUPERBUILDER.image_file_format_by_ext_Builder.call(this);
				break;
			case 'simple-plot-2d':
				SUPERBUILDER.simple_plot_2d_builder.call(this);
				break;
			default:
				SUPERBUILDER.invalidBuilder.call(this);
		}
	};
	//Define SUPERBUILDER
	if (!window.SUPERBUILDER) window.SUPERBUILDER = SUPERBUILDER;

	/**
	 * Builder for scalar type input structure.
	 * Adds a slider to determine which value along the specificied
	 * dimension to query.
	 */
	SUPERBUILDER.scalarBuilder = function() {
		var self = this;
		if (this.info.io != 'input') {
			SUPERBUILDER.invalidBuilder.call(this);
			return;
		}
		if (this.info.arguments.interpolate)
			console.log("Warning: Scalar input does not currently support the 'interpolate' argument");

		//Determine values
		var key = this.info.arguments.value;
		var values = SUPERBUILDER.Utils.getUniqueNumericValues(
			this.source.data.map(function(d){return d[key];})
		);
		//Filter into range if defined
		if (this.info.arguments.range) {
			values = values.filter(function(d) {
				return d >= this.info.arguments.range[0] && d <= this.info.arguments.range[1]
			});
		}

		//Build content
		var contents = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content');
		contents.append('div')
			.attr('class','label');
		contents.append('div')
			.attr('class','controlWrapper')
			.append('input')
				.attr('type','range')
				.attr('min',0)
				.attr('max',values.length-1)
				.attr('step',1)
				.attr('value',0)
				.on('input',function() {
					updateQuery();
					self.update();
				});

		var updateQuery = function() {
			var val = values[contents.select('input').node().value];
			contents.select('.label').text(val + " " + self.info.arguments.units);
			self.query = self.source.data.filter(function(d) {
				return d[key] == val;
			});
		};
		updateQuery();
	}

	/**
	 * Builder for a category type input structure
	 * Creates a drop-down menu to select a value on the specified dimension
	 */
	SUPERBUILDER.categoryBuilder = function() {
		var self = this;
		if (this.info.io != 'input') {
			SUPERBUILDER.invalidBuilder.call(this);
			return;
		}

		//Determine values
		var key = this.info.arguments.value;
		var values = SUPERBUILDER.Utils.getUniqueOrdinalValues(
			this.source.data.map(function(d){return d[key];})
		);

		//Build content
		var selection = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.append('div')
				.attr('class','controlWrapper')
				.append('select')
				.on('change',function(){
					updateQuery();
					self.update();
				});
		selection.selectAll('option')
			.data(values)
			.enter().append('option')
				.attr('value',function(d){return d;})
				.text(function(d){return d;});
		
		var updateQuery = function() {
			var val = selection.node().value;
			self.query = self.source.data.filter(function(d) {
				return d[key] == val;
			});
		};
		updateQuery();
	};

	/**
	 * Builder for a camera-orbit type input structure
	 * Display a graticule that can be click-and-dragged on to orbit the view
	 */
	SUPERBUILDER.camera_orbit_builder = function() {
		var self = this;
		//Determine phi and theta values
		var pKey = this.info.arguments.phi_theta[0],
			tKey = this.info.arguments.phi_theta[1];
		var pVals = SUPERBUILDER.Utils.getUniqueNumericValues(
			this.source.data.map(function(d) {return d[pKey];})
		);
		var tVals = SUPERBUILDER.Utils.getUniqueNumericValues(
			this.source.data.map(function(d) {return d[tKey];})
		);
		//Keep track of which phi or theta is currently queried (by index)
		var pIndex = 0,
			tIndex = 0;

		//Create and add graticule
		var graticule = new SUPERBUILDER.Utils.Graticule();
		var contents = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.each(function(){this.appendChild(graticule.wrapper);});
		graticule.updateSize();
		new ResizeSensor(contents.node(), function() {
			graticule.updateSize();
		});

		//Add dragging behavior to graticule
		var startX = 0,
			startY = 0;
		d3.select(graticule.wrapper).call(d3.drag()
			.on('start', function() {
				startX = d3.event.x;
				startY = d3.event.y;
			})
			.on('drag', function() {
				//rotate graticule
				var dx = d3.event.dx/(graticule.squareSize/100);
				var dy = d3.event.dy/(graticule.squareSize/100);
				graticule.setRotation(graticule.phi+dx,graticule.theta-dy);

				//Get distance dragged since drag started or since phi or theta last updated
				var dxTotal = d3.event.x - startX;
				var dyTotal = -(d3.event.y - startY);
				//If x has changed enough, increment or decrement pIndex and update
				if (Math.abs(dxTotal) > graticule.squareSize/pVals.length) {
					pIndex = dxTotal > 0 ? Math.min(pVals.length-1,pIndex+1) :
											Math.max(0,pIndex-1);
					startX = d3.event.x;
					updateQuery();
					self.update();
				}
				//If y has changed enough, increment or decrement tIndex and update
				if (Math.abs(dyTotal) > graticule.squareSize/tVals.length) {
					tIndex = dyTotal > 0 ? Math.min(tVals.length-1,tIndex+1) :
											Math.max(0,tIndex-1);
					startY = d3.event.y;
					updateQuery();
					self.update();
				}
			})
			.on('end', function() {
				graticule.setRotation(0,0);
			}));

		//Update query according to pIndex and tIndex
		var updateQuery = function() {
			var phi = pVals[pIndex],
				theta = tVals[tIndex];
			self.query = self.source.data.filter(function(d) {
				return (d[pKey] == phi && d[tKey] == theta);
			});
		}
		updateQuery();
	}

	/**
	 * Builder for a table type input.
	 * Simply displays all data in a table with checkboxes of which ones to allow
	 */
	SUPERBUILDER.inputTableBuilder = function() {
		var self = this;
		var keys = Object.keys(this.source.data[0]);

		var table = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.append('table');
		table.selectAll('tr')
			.data(this.source.data).enter()
			.append('tr')
			.each(function(d,i) {
				d3.select(this).append('td')
					.attr('class','checkboxCell')
					.append('input').attr('type','checkbox')
						.on('input',function() {
							if (this.checked)
								self.query.push(d);
							else
								self.query.splice(self.query.indexOf(d),1);
							self.update();
						});
				for (var key in keys)
					d3.select(this).append('td')
						.text(d[keys[key]]);
			});
		this.query = [];
	}

	/**
	 * Builder for a table type output
	 * Simply displays all output data in a table
	 */
	SUPERBUILDER.outputTableBuilder = function() {
		var keys = Object.keys(this.source.data[0]);

		var table = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.append('table');
		
		this.updateListeners.push(function() {
			var rows = table.selectAll('tr')
				.data(this.query);
			rows.each(function(d) {
				d3.select(this).html('');
				for (var key in keys)
					d3.select(this).append('td')
						.text(d[keys[key]]);
			});
			rows.enter().append('tr').each(function(d) {
				d3.select(this).html('');
				for (var key in keys)
					d3.select(this).append('td')
						.text(d[keys[key]]);
			});
			rows.exit().remove();
		})
	}

	/**
	 * Builder for a image-file-format-by-ext type output structure
	 * Displays an image for every visible result
	 */
	SUPERBUILDER.image_file_format_by_ext_Builder = function() {
		if (this.info.io != 'output') {
			SUPERBUILDER.invalidBuilder.call(this);
			return;
		}

		var parser = new SUPERBUILDER.Utils.URI_Parser(this.info.arguments);
		var contents = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content');

		var dir = this.db.directory;
		this.updateListeners.push(function() {
			var displays = contents.selectAll('img')
				.data(this.query.map(function(d){return dir+parser.parse(d);}))
					.attr('src',function(d){return d;});
			displays.enter()
				.append('img')
				.attr('src',function(d){return d;});
			displays.exit()
				.remove();
		});
	}

	/**
	 * Builder for a simple-plot-2d type output structure
	 * For each result, loads data from a csv file and displays it
	 * on either a LineGraph or ScatterGraph depending on arguments
	 */
	SUPERBUILDER.simple_plot_2d_builder = function() {
		if (this.info.io != 'output') {
			SUPERBUILDER.invalidBuilder.call(this);
			return;
		}
		var parser = new SUPERBUILDER.Utils.URI_Parser(this.info.arguments);

		if (this.info.arguments.style == 'line')
			var graph = new SUPERBUILDER.Utils.LineGraph(this.info.arguments);
		else if (this.info.arguments.style == 'scatter')
			var graph = new SUPERBUILDER.Utils.ScatterGraph(this.info.arguments);
		else {
			console.log("Unrecognized graph style " + this.info.arguments.style +
						". Defaulting to line.");
			var graph = new SUPERBUILDER.Utils.LineGraph(this.info.arguments);
		}

		var contents = d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.each(function(){this.appendChild(graph.graph);})
		graph.updateSize();
		//Update the size of the graph when the structure contents change size
		new ResizeSensor(contents.node(), function() {
			graph.updateSize();
		});

		var dir = this.db.directory;
		this.updateListeners.push(function() {
			var datasets = [];
			var self = this;
			for (var i in this.query) {
				//Load csv
				d3.csv(dir+parser.parse(this.query[i]),function(csvData) {
					datasets.push(csvData.map(function(d) {
						return {
							x: Number(d[self.info.arguments.xy[0]]),
							y: Number(d[self.info.arguments.xy[1]])
						};
					}));
					//Set graph data once all datasets have loaded
					if (datasets.length == self.query.length)
						graph.setData(datasets);
				})
			}
		});
	}

	/**
	 * Default builder for any structure type that
	 * for which the SuperBuilder does not have a builder.
	 * Displays a simple warning message
	 */
	SUPERBUILDER.invalidBuilder = function() {
		d3.select(this.content).append('div')
			.attr('class','SUPERBUILDER_Content')
			.text('Could not create structure for type' + this.info.type +
					' with io ' + this.info.io);
	};

	/****************
	 * UTILITIES
	 ****************/

	SUPERBUILDER.Utils = {};

	/**
	 * Given a list of values, return a sorted list of the unique
	 * values, ignoring any NaN values.
	 */
	SUPERBUILDER.Utils.getUniqueNumericValues = function(vals) {
		return vals.filter(function(d) {
			var nan = isNaN(d);
			if (nan)
				console.log("NaN value "+d+" will be ignored.");
			return !nan;
		}).filter(function(d,i,a) {
			return i == a.indexOf(d);
		}).sort(function(a,b) {
			return Number(a) - Number(b);
		});
	};

	/**
	 * Given a list of values (numeric or otherwise), return
	 * a list of the unique values
	 */
	SUPERBUILDER.Utils.getUniqueOrdinalValues = function(vals) {
		return vals.filter(function(d,i,a) {
			return i == a.indexOf(d);
		})
	}

	/**
	 * Instantiate a URI_Parser, which, given a structure's arguments,
	 * can parse the uri_format into a filename
	 */
	SUPERBUILDER.Utils.URI_Parser = function(args) {
		this.pattern = args.uri_format;
		//matches control characters (%d,%f,%s,etc.)
		//(the match includes the character before the percent sign because it has to check if
		//it was escaped with a preceeding slash)
		var matches = this.pattern.match(this.regEx);
		//The pattern split around the same matches.
		this.splitPattern = this.pattern.split(this.regEx);
		//The keys for each dimension to replace control characters with
		this.keys = [];
		for (var i in matches) {
			//Rejoin each part of the split pattern with the first character of the
			//corresponding match to include characters that were matched before the percent sign
			if (matches[i].length != 2)
				this.splitPattern[i] += matches[i].charAt(0);
			//Print an error if a control character doesn't have a corresponding argument
			if (!args[i])
				console.log("ERROR: Missing argument " + i + " for uri_format " + this.pattern);
			this.keys.push(args[i]);
		}
		
	};
	/**
	 * For a given data point in this structure's source,
	 * return the filename according to the uri_format argument
	 */
	SUPERBUILDER.Utils.URI_Parser.prototype.parse = function(data) {
		var result = this.splitPattern[0];
		for (var i in this.keys) {
			if (this.keys[i] && data[this.keys[i]]) {
				result += data[this.keys[i]];
				result += this.splitPattern[Number(i)+1];
			}
		}
		return result;
	};
	//Regex used to parse out control characters (%d,%f,%s,etc.)
	SUPERBUILDER.Utils.URI_Parser.prototype.regEx = /(?:^|[^\\])%[sdfxX]/g;

	/**
	 * Create a new instance of a Graticule, a globe with gridlines on it.
	 */
	SUPERBUILDER.Utils.Graticule = function(args) {
		this.width = this.height = this.squareSize = 0;
		this.phi = this.theta = 20;
		var wrapper = d3.select(document.createElement('div'))
			.attr('class','graticuleWrapper')
			.style('position','relative');
		this.svg = wrapper.append('svg')
			.style('position','absolute');
		this.ring = this.svg.append('circle');
		this.path = this.svg.append('path')
				.datum(d3.geoGraticule().step([30,30]));
		this.wrapper = wrapper.node();
	};

	/**
	 * Update the size of the graticule. Called when the size of its
	 * container changes
	 */
	SUPERBUILDER.Utils.Graticule.prototype.updateSize = function() {
		this.width = this.wrapper.clientWidth;
		this.height = this.wrapper.clientHeight;
		this.squareSize = Math.min(this.width,this.height);
		d3.select(this.wrapper).select('svg')
			.attr('width',this.width+'px')
			.attr('height',this.height+'px');
		this.redraw();
	}

	/**
	 * Set the rotation of the graticule to the given phi and theta values.
	 */
	SUPERBUILDER.Utils.Graticule.prototype.setRotation = function(p,t) {
		this.phi = p;
		this.theta = t;
		this.redraw();
	};

	/**
	 * Redraw the graticule.
	 */
	SUPERBUILDER.Utils.Graticule.prototype.redraw = function() {
		var projection = d3.geoOrthographic()
			.clipAngle(90)
			.translate([this.width/2,this.height/2])
			.scale(this.squareSize/2-10)
			.rotate([this.phi,this.theta]);
		this.path.attr("d",d3.geoPath().projection(projection));
		this.ring
			.attr('cx',this.width/2)
			.attr('cy',this.height/2)
			.attr('r',this.squareSize/2-10);
	}

	/**
	 * Abstract constructor for a generic graph.
	 * Is instantiated through either LineGraph or ScatterGraph
	 * Includes an svg for the main graph, and two axes
	 */
	SUPERBUILDER.Utils.Graph = function(args) {
		if (this.constructor === SUPERBUILDER.Utils.Graph)
			throw new Error("Cannot instantiate abstract graph! Please use a subclass");

		this.margins = {top: 10, right: 10, bottom: 35, left: 75};
		this.width = this.height = 0;
		var wrapper = d3.select(document.createElement('div'))
			.attr('class','graphWrapper')
			.style('position','relative');
		//Append main graph svg
		wrapper.append('svg')
			.attr('class','viewport')
			.style('position','absolute')
			.style('top',this.margins.top)
			.style('left',this.margins.left);
		//Append xAxis
		wrapper.append('svg')
			.attr('class','axis')
			.attr('axis','x')
			.style('position','absolute')
			.style('left',this.margins.left)
			.style('bottom',0)
			.style('height',this.margins.bottom)
			.style('overflow','visible')
			.append('g')
				.attr('class','axisContent')
		//Append yAxis
		wrapper.append('svg')
			.attr('class','axis')
			.attr('axis','y')
			.style('position','absolute')
			.style('top',this.margins.top)
			.style('left',0)
			.style('width',this.margins.left)
			.style('overflow','visible')
			.append('g')
				.attr('class','axisContent')
				.style('transform','translateX('+this.margins.left+'px)');
		this.graph = wrapper.node();

		//Ranges for each axis
		this.ranges = args.ranges;

		//Array for each dataset to display
		this.datasets = [];

		//Create xScale
		if (args.scales[0] == 'linear')
			this.xScale = d3.scaleLinear();
		else if (args.scales[0] == 'log10')
			this.xScale = d3.scaleLog();
		else {
			console.log("Unrecognized X-Axis scale type " + args.scales[0] + 
						"in structure must be either 'linear' or 'log10'" +
						"Defaulting to linear");
			this.xScale = d3.scaleLinear();
		}
		//Create domain for xScale according to range
		if (args.ranges[0])
			this.xScale.domain(args.ranges[0]);
		this.xAxis = d3.axisBottom(this.xScale);
		//Bind xAxis to xScale
		wrapper.select('.axis[axis="x"] .axisContent').call(this.xAxis);

		//Create yScale
		if (args.scales[1] == 'linear')
			this.yScale = d3.scaleLinear();
		else if (args.scales[1] == 'log10')
			this.yScale = d3.scaleLog().base(10);
		else {
			console.log("Unrecognized Y-Axis scale type " + args.scales[1] + 
						"in structure must be either 'linear' or 'log10'" +
						"Defaulting to linear");
			this.yScale = d3.scaleLinear();
		}
		//Create domain for yScale according to range
		if (args.ranges[1])
			this.yScale.domain(args.ranges[1]);
		this.yAxis = d3.axisLeft(this.yScale);
		//Bind yAxis to yScale
		wrapper.select('.axis[axis="y"] .axisContent').call(this.yAxis);

		//Create xAxis label
		wrapper.select('.axis[axis="x"]').append('text')
			.style('text-anchor','middle')
			.text(args.labels[0] + ' ('+args.units[0]+')');

		//Create yAxis label
		wrapper.select('.axis[axis="y"]').append('text')
			.style('text-anchor','middle')
			.style('transform','rotate(-90deg)')
			.text(args.labels[1] + ' ('+args.units[1]+')');
	};

	/**
	 * Called when a graph changes size.
	 * Recalculates the scales, resizes elements and redraws data
	 */
	SUPERBUILDER.Utils.Graph.prototype.updateSize = function() {
		//Recalculate width and height
		this.width = this.graph.clientWidth - (this.margins.right + this.margins.left);
		this.height = this.graph.clientHeight - (this.margins.top + this.margins.bottom);
		//Recalculate xScale and ySccale ranges
		this.xScale.range([0,this.width]).clamp(true);
		this.yScale.range([this.height,0]).clamp(true);
		//Reszie elements and rebind axes
		d3.select(this.graph).select('.viewport')
			.style('width',this.width)
			.style('height',this.height);
		d3.select(this.graph).select('.axis[axis="x"]')
			.style('width',this.width)
			.select('.axisContent')
				.call(this.xAxis);
		d3.select(this.graph).select('.axis[axis="y"]')
			.style('height',this.height)
			.select('.axisContent')
				.call(this.yAxis);
		
		//Reposition labels
		d3.select(this.graph).select('.axis[axis="x"] > text')
			.attr('x',this.width/2)
			.attr('y',this.margins.bottom);
		d3.select(this.graph).select('.axis[axis="y"] > text')
			.attr('x',-this.height/2)
			.attr('y',15)

		this.redrawData();
	};

	/**
	 * Set the data for the graph and redraw
	 */
	SUPERBUILDER.Utils.Graph.prototype.setData = function(datasets) {
		this.datasets = datasets;

		//Calculate the extent of the xAxis and set the domain
		if (!this.ranges[0]) {
			var xExtent = [0,0];
			for (var i in datasets)
				xExtent = d3.extent(xExtent.concat(datasets[i].map(function(d){
					return d.x;
				})));
			//If the scale is logarithmic, (judging by the presence of the base function),
			//and the extent crosses 0, rescale it so that it is either strictly positive or strictly negative.
			if (this.xScale.base && xExtent[0] <= 0 && xExtent[1] >= 0) {
				if (xExtent[0] < 0)
					xExtent[1] = -0.001;
				else if (xExtent[0] == 0)
					xExtent[0] = 0.001;
			}
			this.xScale.domain(xExtent);
			d3.select(this.graph).select('.axis[axis="x"] .axisContent')
				.call(this.xAxis);
		}

		//Calculate the extent of the yAxis and set the domain
		if (!this.ranges[1]) {
			var yExtent = [0,0];
			for (var i in datasets)
				yExtent = d3.extent(yExtent.concat(datasets[i].map(function(d){
					return d.y;
				})));
			//If the scale is logarithmic, (judging by the presence of the base function),
			//and the extent crosses 0, rescale it so that it is either strictly positive or strictly negative.
			if (this.yScale.base && yExtent[0] <= 0 && yExtent[1] >= 0) {
				if (yExtent[0] < 0)
					yExtent[1] = -0.001;
				else if (yExtent[0] == 0)
					yExtent[0] = 0.001;
			}
			this.yScale.domain(yExtent);
			d3.select(this.graph).select('.axis[axis="y"] .axisContent')
				.call(this.yAxis);
		}

		this.redrawData();
	}

	//Constructor for LineGraph
	SUPERBUILDER.Utils.LineGraph = function(args) {
		SUPERBUILDER.Utils.Graph.call(this, args);
	};
	SUPERBUILDER.Utils.LineGraph.prototype = Object.create(SUPERBUILDER.Utils.Graph.prototype);
	SUPERBUILDER.Utils.LineGraph.prototype.constructor = SUPERBUILDER.Utils.LineGraph;

	/**
	 * Redraw data for LineGraph
	 * Draw one line on the graph for each dataset
	 */
	SUPERBUILDER.Utils.LineGraph.prototype.redrawData = function() {
		var self = this;
		var lines = d3.select(this.graph).select('.viewport').selectAll('.dataset')
			.data(self.datasets.map(function(d) {
				return d.map(function(p) {
					return {x: self.xScale(p.x), y: self.yScale(p.y)};
				});
			}))
			.attr('d',function(d) {return self.lineFromPoints(d);});
		lines.enter()
			.append('path')
				.attr('class','dataset')
				.attr('type','line')
				.attr('d',function(d) {return self.lineFromPoints(d);});
		lines.exit().remove();
	};

	/**
	 * For a LineGraph, get the line shape (contents of the 'd' attribute)
	 * for a given set of points
	 */
	SUPERBUILDER.Utils.LineGraph.prototype.lineFromPoints = function(points) {
		var path = "M 0 " + this.height;
		for (var i in points)
				path += " L" + points[i].x + " " + points[i].y;
		path += " L" + this.width + " " + this.height;
		return path;
	};

	//Constructor for ScatterGraph
	SUPERBUILDER.Utils.ScatterGraph = function(args) {
		SUPERBUILDER.Utils.Graph.call(this, args);
	};
	SUPERBUILDER.Utils.ScatterGraph.prototype = Object.create(SUPERBUILDER.Utils.Graph.prototype);
	SUPERBUILDER.Utils.ScatterGraph.prototype.constructor = SUPERBUILDER.Utils.ScatterGraph;

	/**
	 * Redraw data for a ScatterGraph
	 * Draw a collection of dots for each data set
	 */
	SUPERBUILDER.Utils.ScatterGraph.prototype.redrawData = function() {
		var self = this;
		var sets = d3.select(this.graph).select('.viewport').selectAll('.dataset')
			.data(self.datasets.map(function(d) {
				return d.map(function(p) {
					return {x: self.xScale(p.x), y: self.yScale(p.y)};
				});
			}))
			.each(bindPoints);
		sets.enter().append('svg')
			.attr('class','dataset')
			.attr('type','scatter')
			.each(bindPoints);
		sets.exit().remove();

		//Create the individual dots for one dataset
		function bindPoints(dataset) {
			var points = d3.select(this).selectAll('.point')
				.data(dataset)
				.attr('cx',function(p) {return p.x;})
				.attr('cy',function(p) {return p.y;})
				.attr('r',1);
			points.enter().append('circle')
				.attr('class','point')
				.attr('cx',function(p) {return p.x;})
				.attr('cy',function(p) {return p.y;})
				.attr('r',1);
			points.exit().remove();
		}

	}

})();