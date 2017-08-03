#CVLIB-D

##Author: Cameron Tauxe

CVLIB-D is a javascript framework to faciliate the creation of viewer applications for Spec-D Advanced Cinema Databases.

Because of the wide variety of data that Spec-D can represent, viewers for Spec-D databases often have to be custom-built for viewing a specific kind of data. This CVLIB-D is a not a viewer itself, but a library which handles the connection between Sources, Displays and Input/Output Structures as outlined in the databases JSON file to allow for the very easy creation of highly-customizable viewer applications.

##Example
Paired with the **SuperBuilder** and **SuperLoader** plug-ins (included), making a simple viewer for Spec-D database can be done in only a few lines of code.

```javascript
//Create a new database from a json file
new CVLIBD.Database("myDatabase.json", function(db) {
	//Add SuperLoader for Sources
	db.setLoadersForAll(SUPERLOADER);
	//Add SuperBuilder for Structures
	db.addBuildersToAll(SUPERBUILDER);

	//Activate the main display,
	//loading the source and building the structures
	db.displays["main"].activate();

	//Append each structure to the page body
	for (var key in db.displays["main"].structures) {
		var struct = db.displays["main"].structures[key];
		document.body.appendChild(struct.content);
	}
});
```

##Architecture
CVLIB-D provides the following classes, representing various elements of the Spec-D Advanced Specification:
* **Database**: An over-arching class representing the entire database. Contains sources and displays
* **Source**: Represents a data source. Loads data through use of a special *loader* function and stores it for use by displays and structures.
* **Display**: Represents a single display (set of input/output structures). Draws data from a single source and uses its input structures to determine a subset of the data to display on its output structures.
* **InputStrcuture**: Represents a single structure with io 'input.' Given a data source, provides controls (created through a special *builder* function)to define a subset of the data to view.
* **OutputStructure**: Represents a single structure with io 'output.' Given a data source, provides an interface (created through a special *builder* function) to display a subset of data. (This subset is the intersection of the subsets defined by all input structures in the same display).

##Guide

###The SuperBuilder and SuperLoader Plug-Ins
Each input or output structure is given a *builder* function which is called to create the DOM content of the structure (controls for an input structure, a view for an output structure).
Similiarly, each source is given a *loader* function which is called to read the source's file and populate an array of data.
These builder and loader functions can be custom-built for specific structures or sources, which may be needed for specialized data, but for simpler structures and data formats, the SuperBuilder and SuperLoader plug-ins can be used which provide a variety of default builder and loader functions for common structures and data formats.

####The SuperBuilder
To use the SuperBuilder, simply add it as you would any other builder, like so:
```javascript
//add the SuperBuilder to a single structure called 'struct'
struct.builders.push(SUPERBUILDER);
//add the SuperBuilder to all structures in a database called 'db'
db.addBuildersToAll(SUPERBUILDER);
```
The SuperBuilder is itself a builder function which will defer to one of its sub-functions to build content depending on the type of the structure as defined in the structure's JSON. **Refer to the Spec-D Specification to see what arguments are required for what types**
Currently the SuperBuilder supports the following types
* **scalar (input)**: Used for a dimension with a numeric range of values. Creates a slider to control which value to display.
* **category (input)**: Used for a dimension with non-numeric values. Creates a drop-down menu to select which value to display.
* **camera-orbit (input)**: Used for controlling a camera orbiting around the dataset. Creates a globe which can be click-and-dragged on to rotate view.
* **table (input or output)**: Very basic way to view the raw data. As an input, displays a table with all the data along with their values and a checkbox to determine if that data point should be displayed. As an output, displays a table with the values of all shown data.
* **image-file-format-by-ext (output)**: Used for results which output an image. Display an image for each result.
* **simple-plot-2d (output)**: Used for reusults which output other data. Display results on either a line graph or scatter plot.

####The SuperLoader
To use the SuperLoader, simply add it as you would any other loader, like so:
```javascript
//add the SuperLoader to a single source called 'src'
src.loader = SUPERLOADER;
//add the SuperLoader to all sources in a database called 'db'
db.setLoadersForAll(SUPERLOADER);
```
The SuperLoader is itself a loader function which will defer to one of its sub-functions to load data depending on the mime type of the source as defined in the source's JSON.
Currently, the SuperLoader supports the following mime types
* **text/csv**: Load data from a csv file.
* **text/tsv**: Load data from a tsv file.

### Making your own Builder (for inputs)
Let's examine the code of the following builder (from the SuperBuilder function for a category input structure)
```javascript
//Using D3
SUPERBUILDER.categoryBuilder = function() {
	var self = this;

	//Determine values
	var key = this.info.arguments.value;
	var values = SUPERBUILDER.Utils.getUniqueOrdinalValues(
		this.source.data.map(function(d){return d[key];})
	);

	//Build content
	//Add drop-down (select) inside SUPERBUILDER_Content wrapper
	var selection = d3.select(this.content).append('div')
		.attr('class','SUPERBUILDER_Content')
		.append('div')
			.attr('class','controlWrapper')
			.append('select')
			//When changed, update query and then
			//call update method to alert the display that changes have been made
			.on('change',function(){
				updateQuery();
				self.update();
			});
	//Add options to drop-down
	selection.selectAll('option')
		.data(values)
		.enter().append('option')
			.attr('value',function(d){return d;})
			.text(function(d){return d;});
	
	//Update query according to selected value
	var updateQuery = function() {
		var val = selection.node().value;
		self.query = self.source.data.filter(function(d) {
			return d[key] == val;
		});
	};
	updateQuery();
};
```
As you can see, the builder is a function that appends elements to the structure's content and then allows for the elements to change the structure's query and call the structure's update method (which allows output structures in the same display to update). Note that the function is called with **this** referring to the structure it's building. For the most part, the code within the function can be whatever you want. However, there are some important rules that *all* builders for input structures must abide by to work.
* The builder must directly change the value(s) of the structure's query. The query is the list of data that this input will allow to be displayed (e.g. All the data whose value on a certain dimension match the selected value). Usually, this can be done with a filter on **this.source.data**, which refers to the entire dataset.
* When the query is changed, the structure's update function (**this.update**) *must* be called. It is not called automatically when changing the query. This alerts the structure's parent display that a change has been made so that output structures can be updated accordingly
* Immediately upon finishing building, the query should be set to some value consistent with the beginning state of the structure's controls if it has them. (This is why **updateQuery** is called at the end of the function). *However*, the update function should not be called as soon as the the structure is built. This is because, at the time of building, not all strucures (output or otherwise) may have been built yet. The update function will be called automatically once all structures have been built.
* It is strongly recommended that builders append to the structure's content rather than completely replace it. This allows a structure to have multiple builders that will all add their own content one after the other.

### Making your own Builder (for outputs)
Let's examine the code of the following builder (from the SuperBuilder function for a table output structure)
```javascript
//Using D3
SUPERBUILDER.outputTableBuilder = function() {
	//get keys for data
	var keys = Object.keys(this.source.data[0]);

	//create table
	var table = d3.select(this.content).append('div')
		.attr('class','SUPERBUILDER_Content')
		.append('table');
	
	//Add update listener to update table content
	//according to query
	this.updateListeners.push(function() {
		//rebind query data to table
		var rows = table.selectAll('tr')
			.data(this.query);
		//update current rows
		rows.each(function(d) {
			//clear row and add cells for each dimension
			d3.select(this).html('');
			for (var key in keys)
				d3.select(this).append('td')
					.text(d[keys[key]]);
		});
		//add new rows
		rows.enter().append('tr').each(function(d) {
			//clear row and add cells for each dimension
			d3.select(this).html('');
			for (var key in keys)
				d3.select(this).append('td')
					.text(d[keys[key]]);
		});
		//remove old rows
		rows.exit().remove();
	})
}
```
The builder for an output structure is very similiar to one for an input structure. Like with input structures, the builder is called with **this** referring to the structure and elements are appended to the structure's content object. The main difference with output builders is the way updates are handled since output structures are designed to listen for and respond to updates as opposed to making them. Output structures have an array of functions called **updateListeners** which contains functions that will automatically be called when an input in the same display updates. Like, the builder function itself, the update listeners are called with **this** referring to the structure. In an output structure, the query represents the data that should be displayed, and by the time update listeners are called, has already been automatically changed. So an update listener must use the query to determine how to update the contents of the structure. Note that all output builders are expected to be able to handle a query of any size (including zero).

### Making your own Loader
Compared to a custom builder, custom loaders are very simple. Let's examine the code for the following loader (from the SuperLoader function for a "text/csv" type source)
```javascript
SUPERLOADER.csvLoader = function(callback) {
	var self = this;
	//request text of csv file specified in the source's uri (info.uri)
	SUPERLOADER.textRequest.call(this,this.info.uri, function(text) {
		//parse into data
		self.data = d3.csvParse(text);
		//callback
		callback.call(this);
	});
}
```
At the simplest level, a loader simply takes a given source and populates its data array. In this case, this is done by using the source's uri to load a csv file and retrieve data. The loader is called with **this** referring to the source. However there are still some rules that all loaders must abide by:
* A loader is given, as an argument, a callback function. When loading has entirely finished, this callback function should be called with **this** referring, again, to the source object.
* Data is expected to be an array of objects where each object has keys dimension in the dataset along with its corresponding value. For example, the following csv file...
```
a,b,c,image
foo,20,56,asdf.png
bar,64,21,hjkl.png
blah,78,43,bleh.png
```
will produce the following data array (represented here in JSON format)
```json
[
	{"a": "foo", "b": 20, "c": 56, "image": "asdf.png"},
	{"a": "bar", "b": 64, "c": 21, "image": "hjkl.png"},
	{"a": "blah", "b": 78, "c": 43, "image": "bleh.png"},
]
```

## Dependencies
The CVLIB-D library itself has no dependencies, however the SuperBuilder and SuperLoader require the following libraries (already included in this repository):
* D3v4
* ElementQueries
* ResizeSensor (part of ElementQueries)

## Changelog
* **Version 1.0**: Initial release

## Development To-Do
* Once there is an official version of the spec, add verification to ensure that a JSON obeys the spec upon loading and before doing anything else.
* Always be adding support for more structures and sources to SuperBuilder and SuperLoader respectively.