/*
 * Creates a search box, binding it to a UI input and to a map. If pushToMap is true,
 * the input is pushed to a position relative to the map.
 * 
 * 	map: the Google map to bind the search box to
 * 	pushToMap: if true, binds to map
 * 	element_id: the html ID of the search box
 * 
 * 	returns: Google searchbox
 */
function initializeSearchBox(map, pushToMap, element_id) {	
	// Create the search box and link it to the UI element.
	var input = /** @type {HTMLInputElement} */
		(document.getElementById(element_id));
	
	var searchBox = new google.maps.places.SearchBox(
			/** @type {HTMLInputElement} */
			(input));
	
	if (pushToMap) {
		map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
	}
	// [START region_getplaces]
	// Listen for the event fired when the user selects an item from the
	// pick list. Retrieve the matching places for that item.	
	google.maps.event.addListener(searchBox, 'places_changed', function() {
		console.log("Changed!");
		var places = searchBox.getPlaces();

		if (places.length == 0) {
			return;
		}
		var bounds = new google.maps.LatLngBounds();
		for (var i = 0, place; place = places[i]; i++) {
			bounds.extend(place.geometry.location);
		}

		suspendAndResumeHeatmap();
		map.fitBounds(bounds);
	});
	// [END region_getplaces]
	
	return searchBox;
}
