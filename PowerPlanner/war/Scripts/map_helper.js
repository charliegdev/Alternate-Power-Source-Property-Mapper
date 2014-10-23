var g_map; /* The main map */
var g_heatmap; /* The heatmap layer for the main map */

var wind_data = []; /* The wind data for the current heatmap view */
var solar_data = []; /* The solar data for the current heatmap view */
var hydro_data = []; /* The hydro data for the current heatmap view */

//This example adds a search box to a map, using the Google Place Autocomplete
//feature. People can enter geographical searches. The search box will return a
//pick list containing a mix of places and predicted search terms.

function initialize() {

	var markers = [];
	var map = new google.maps.Map(document.getElementById('googleMap'), {
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		zoom : 14,
		maxZoom : 15,
		minZoom : 8,
		streetViewControl : false,
		scaleControl : true,
		center : new google.maps.LatLng(48.4647, -123.3085),
		styles : [ {
			featureType : "poi",
			elementType : "labels",
			stylers : [ {
				visibility : "off"
			} ]
		} ]
	});

	var defaultBounds = new google.maps.LatLngBounds(
			new google.maps.LatLng(48.4647, -123.3085),
			new google.maps.LatLng(48.4647, -123.3085));
	map.fitBounds(defaultBounds);

//	Create the search box and link it to the UI element.
	var input = /** @type {HTMLInputElement} */(
			document.getElementById('pac-input'));
	var inputIntro = /** @type {HTMLInputElement} */(
			document.getElementById('pac-input-intro'));
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

	var searchBox = new google.maps.places.SearchBox(
			/** @type {HTMLInputElement} */(input));
	var searchBoxIntro = new google.maps.places.SearchBox(
			/** @type {HTMLInputElement} */(inputIntro));

//	[START region_getplaces]
//	Listen for the event fired when the user selects an item from the
//	pick list. Retrieve the matching places for that item.
	google.maps.event.addListener(searchBox, 'places_changed', function() {
		var places = searchBox.getPlaces();

		if (places.length == 0) {
			return;
		}
		for (var i = 0, marker; marker = markers[i]; i++) {
			marker.setMap(null);
		}

		// For each place, get the icon, place name, and location.
		markers = [];
		var bounds = new google.maps.LatLngBounds();
		for (var i = 0, place; place = places[i]; i++) {
			var image = {
					url: place.icon,
					size: new google.maps.Size(71, 71),
					origin: new google.maps.Point(0, 0),
					anchor: new google.maps.Point(17, 34),
					scaledSize: new google.maps.Size(25, 25)
			};

			// Create a marker for each place.
			var marker = new google.maps.Marker({
				map: map,
				icon: image,
				title: place.name,
				position: place.geometry.location
			});

			markers.push(marker);

			bounds.extend(place.geometry.location);
		}

		map.fitBounds(bounds);
	});
//	[END region_getplaces]

//	Bias the SearchBox results towards places that are within the bounds of the
//	current map's viewport.
	google.maps.event.addListener(map, 'bounds_changed', function() {
		var bounds = map.getBounds();
		searchBox.setBounds(bounds);
	});

	return map;
}

/*
 * Initializes a test version of the map and heatmap, loading fake data on the
 * client side.
 */
function mapTest() {
	g_map = initialize();
	g_heatmap = initHeatmap(g_map);

	attachHeatmap(g_heatmap, g_map);

	/*
	 * Horrible ugly hack while I figure out why map load callback listener
	 * hangs infinitely. This lets the map finish loading before trying to get
	 * its boundaries.
	 */
	function sleep(millis, callback, map) {
		setTimeout(function() {
			callback(map);
		}, millis);
	}
	sleep(500, loadHeatmapData, g_map);
}

/*
 * Initializes the map, heatmap, and important event listeners.
 */
function mapLoader() {
	g_map = initialize();
	g_heatmap = initHeatmap(g_map);

	attachHeatmap(g_heatmap, g_map);

	google.maps.event.addListener(g_map, 'dragend', _eventHeatmapDataToggler);
	google.maps.event.addListener(g_map, 'zoom_changed',
			_eventHeatmapDataToggler)
}

/*
 * Creates fake data (but only for the loading map view!) of wind, solar, and
 * hydro energy
 */
function loadHeatmapData(map) {
	var startLat = getSWLatitude(map);
	var startLng = getSWLongitude(map);
	var endLat = getNELatitude(map);
	var endLng = getNELongitude(map);

	var offset = 0.00075;

	/* Wind */
	for (var i = 0.0; i <= (endLat - startLat); i += 0.00075) {
		for (var j = 0.0; j <= (endLng - startLng); j += 0.00225) {
			if (Math.random() > 0.45) {
				var weighted = Math.random() / 2.5;
				addHeatmapCoord(wind_data, startLat + i, startLng + j + offset,
						weighted);
			}
		}
		offset = (offset == 0.0 ? 0.00075 : 0.0);
	} // */

	/* Solar */
	for (var i = 0.0; i <= (endLat - startLat); i += 0.00075) {
		for (var j = 0.0; j <= (endLng - startLng); j += 0.00225) {
			if (Math.random() > 0.1) {
				var weighted = Math.random() / 4 + 0.025;
				addHeatmapCoord(solar_data, startLat + i,
						startLng + j + offset, weighted);
			}
		}
		offset = (offset == 0.0 ? 0.00075 : 0.0);
	} // */

	/* Hydro */
	for (var i = 0.0; i <= (endLat - startLat); i += 0.00075) {
		for (var j = 0.0; j <= (endLng - startLng); j += 0.00225) {
			if (Math.random() > 0.9) {
				var weighted = Math.random() / 2 + 0.4;
				addHeatmapCoord(hydro_data, startLat + i,
						startLng + j + offset, weighted);
			}
		}
		offset = (offset == 0.0 ? 0.00075 : 0.0);
	} // */
}

/*
 * Reloads toggled map data; for use in event handlers.
 */
function _eventHeatmapDataToggler() {
	toggleHeatmapData($("#showCheckboxWind").is(':checked'), $(
	"#showCheckboxSolar").is(':checked'), $("#showCheckboxHydro").is(
	':checked'));
}

/*
 * Map data toggle function. Takes boolean values for turning different energy
 * types on and off.
 */
function toggleHeatmapData(showWind, showSolar, showHydro) {
	wind_data = [];
	solar_data = [];
	hydro_data = [];

	if (showWind) {
		_getHeatmapData("WIND", getNELatitude(g_map), getNELongitude(g_map),
				getSWLatitude(g_map), getSWLongitude(g_map));
	}

	if (showSolar) {
		_getHeatmapData("SOLAR", getNELatitude(g_map), getNELongitude(g_map),
				getSWLatitude(g_map), getSWLongitude(g_map));
	}

	if (showHydro) {
		_getHeatmapData("HYDRO", getNELatitude(g_map), getNELongitude(g_map),
				getSWLatitude(g_map), getSWLongitude(g_map));
	}

	if (!showWind && !showSolar && !showHydro) {
		updateHeatmap();
	}
}

/*
 * Sends a POST request to the server for data within the provided latitude and
 * longitude bounds of a particular type. Acceptable types are WIND, SOLAR, and
 * HYDRO. Triggers a heatmap update upon successful server response.
 */
function _getHeatmapData(type, neLat, neLng, swLat, swLng) {
	$.ajax({
		url : '/powerplanner',
		type : 'POST',
		data : {
			type : type,
			neLat : neLat,
			neLng : neLng,
			swLat : swLat,
			swLng : swLng
		},
		dataType : 'json',
		success : function(data, status) {
			if (status) {
				hm_data = [];
				for (var i = 0; i < data.length; i++) {
					addHeatmapCoord(hm_data, data[i].lat, data[i].lng,
							data[i].weight);
				}
				if (type == "WIND") {
					wind_data = hm_data;
				} else if (type == "SOLAR") {
					solar_data = hm_data;
				} else if (type == "HYDRO") {
					hydro_data = hm_data;
				}
				updateHeatmap();
			}
		}
	});
}

/*
 * Initializes heatmap with current basic settings.
 */
function initHeatmap(map) {
	var heatmap = new google.maps.visualization.HeatmapLayer({
		maxIntensity : 1,
		map : map,
		radius : 0.0022,
		dissipating : false,
		opacity : 0.4,
		gradient : [ 'rgba(0,0,0,0)', 'rgba(255,0,0,1)', 'rgba(255,63,0,1)',
		             'rgba(255,127,0,1)', 'rgba(255,191,0,1)', 'rgba(255,255,0,1)',
		             'rgba(223,255,0,1)', 'rgba(191,255,0,1)', 'rgba(159,255,0,1)',
		             'rgba(127,255,0,1)', 'rgba(63,255,0,1)', 'rgba(0,255,0,1)' ]
	});

	return heatmap;
}

/*
 * Attach a heatmap to a map.
 */
function attachHeatmap(heatmap, map) {
	heatmap.setMap(map);
}

/*
 * Updates the global heatmap with the global data arrays.
 */
function updateHeatmap() {
	hm_data = wind_data;
	hm_data = hm_data.concat(solar_data);
	hm_data = hm_data.concat(hydro_data);

	_updateHeatmap(g_heatmap, hm_data);
}

/*
 * Updates the provided heatmap with the provided array of heatmap data points.
 */
function _updateHeatmap(heatmap, hm_data) {
	var datapoints = new google.maps.MVCArray(hm_data);
	heatmap.setData(datapoints);
}

/*
 * Adds a heatmap data point with specified latitude, longitude, and weighting
 * (between 0 and 1) to the provided array.
 */
function addHeatmapCoord(hm_data, lat, lng, weight) {
	hm_data.push({
		location : new google.maps.LatLng(lat, lng),
		weight : weight
	});

	return hm_data;
}

/*
 * Gets the latitude of the southwest map boundary.
 */
function getSWLatitude(map) {
	return map.getBounds().getSouthWest().lat();
}

/*
 * Gets the longitude of the southwest map boundary.
 */
function getSWLongitude(map) {
	return map.getBounds().getSouthWest().lng();
}

/*
 * Gets the latitude of the northeast map boundary.
 */
function getNELatitude(map) {
	return map.getBounds().getNorthEast().lat();
}

/*
 * Gets the longitude of the northeast map boundary.
 */
function getNELongitude(map) {
	return map.getBounds().getNorthEast().lng();
}

/*
 * Map setup entry point.
 */
google.maps.event.addDomListener(window, 'load', mapLoader);
