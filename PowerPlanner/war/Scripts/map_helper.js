var g_map; /* The main map */
var g_heatmap; /* The heatmap layer for the main map */

var wind_data = []; /* The wind data for the current heatmap view */
var solar_data = []; /* The solar data for the current heatmap view */
var hydro_data = []; /* The hydro data for the current heatmap view */

var LEAST_ZOOM = 8;
var DEFAULT_ZOOM = 14;
var MAX_DATA_WIDTH = 0.32;

var POINT_DEBUGGER = false; /* true = view data points instead of interpolation */

/*
 * This example adds a search box to a map, using the Google Place Autocomplete
 * feature. People can enter geographical searches. The search box will return a
 * pick list containing a mix of places and predicted search terms.
 */
function initialize() {

	var markers = [];
	var map = new google.maps.Map(document.getElementById('googleMap'), {
		mapTypeId : google.maps.MapTypeId.ROADMAP,
		zoom : DEFAULT_ZOOM,
		maxZoom : 15,
		minZoom : LEAST_ZOOM,
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

	var defaultBounds = new google.maps.LatLngBounds(new google.maps.LatLng(
			48.4647, -123.3085), new google.maps.LatLng(48.4647, -123.3085));
	map.fitBounds(defaultBounds);

	// Create the search box and link it to the UI element.
	var input = /** @type {HTMLInputElement} */
	(document.getElementById('pac-input'));
	var inputIntro = /** @type {HTMLInputElement} */
	(document.getElementById('pac-input-intro'));
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

	var searchBox = new google.maps.places.SearchBox(
	/** @type {HTMLInputElement} */
	(input));
	var searchBoxIntro = new google.maps.places.SearchBox(
	/** @type {HTMLInputElement} */
	(inputIntro));

	// [START region_getplaces]
	// Listen for the event fired when the user selects an item from the
	// pick list. Retrieve the matching places for that item.
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
				url : place.icon,
				size : new google.maps.Size(71, 71),
				origin : new google.maps.Point(0, 0),
				anchor : new google.maps.Point(17, 34),
				scaledSize : new google.maps.Size(25, 25)
			};

			// Create a marker for each place.
			var marker = new google.maps.Marker({
				map : map,
				icon : image,
				title : place.name,
				position : place.geometry.location
			});

			markers.push(marker);

			bounds.extend(place.geometry.location);
		}

		map.fitBounds(bounds);
	});
	// [END region_getplaces]

	// Bias the SearchBox results towards places that are within the bounds of
	// the
	// current map's viewport.
	google.maps.event.addListener(map, 'bounds_changed', function() {
		var bounds = map.getBounds();
		searchBox.setBounds(bounds);
	});

	return map;
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

	var neLat = getNELatitude(g_map);
	var neLng = getNELongitude(g_map);
	var swLat = getSWLatitude(g_map);
	var swLng = getSWLongitude(g_map);

	if (showWind) {
		_getHeatmapData("WIND", neLat, neLng, swLat, swLng);
	}

	if (showSolar) {
		_getHeatmapData("SOLAR", neLat, neLng, swLat, swLng);
	}

	if (showHydro) {
		_getHeatmapData("HYDRO", neLat, neLng, swLat, swLng);
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
	var lat_offset = (neLat - swLat) / 2;
	var lng_offset = (neLng - swLng) / 2;

	$.ajax({
		url : '/powerplanner',
		type : 'POST',
		data : {
			type : type,
			neLat : neLat + lat_offset,
			neLng : neLng + lng_offset,
			swLat : swLat - lat_offset,
			swLng : swLng - lng_offset
		},
		dataType : 'json',
		success : function(data, status) {
			if (status) {
				var weight_points = [];
				for (var i = 0; i < data.length; i++) {
					weight_points.push(data[i].weight);
				}
				var scaler = getArrayMax(weight_points);
				console.log("Scaler: " + scaler);

				hm_data = [];
				for (var i = 0; i < data.length; i++) {
					addHeatmapCoord(hm_data, data[i].lat, data[i].lng,
							data[i].weight / scaler);
				}
				if (type == "WIND") {
					if (POINT_DEBUGGER) {
						wind_data = hm_data;
					} else {
						wind_data = _interpolateData(hm_data, neLat, neLng,
								swLat, swLng);
					}
				} else if (type == "SOLAR") {
					if (POINT_DEBUGGER) {
						solar_data = hm_data;
					} else {
						solar_data = _interpolateData(hm_data, neLat, neLng,
								swLat, swLng);
					}
				} else if (type == "HYDRO") {
					hydro_data = hm_data;
				}
				updateHeatmap();
			}
		}
	});
}

/*
 * Fills in a grid of all the points visible on the screen as defined by the
 * provided boundary coordinates (with a little bit of bleed over the boundaries
 * to prevent visible edge discolouration) by interpolating values from the
 * provided set of real data points based on a weighting algorithm. Returns the
 * set of interpolated values.
 */
function _interpolateData(hm_data, neLat, neLng, swLat, swLng) {
	var lat_offset = (neLat - swLat) / 10;
	var lng_offset = (neLng - swLng) / 10;

	var lngset = MAX_DATA_WIDTH / Math.pow(2, (g_map.getZoom() - LEAST_ZOOM));
	var latset = lngset / 2;
	var offset = latset;

	var temp_data = [];

	for (var i = 0.0; i <= (neLat - swLat) + 2 * lat_offset; i += latset) {
		for (var j = 0.0; j <= (neLng - swLng) + 2 * lng_offset; j += lngset) {
			var weighted = getDataWeight(hm_data, swLat + i, swLng + j + offset);
			addHeatmapCoord(temp_data, swLat + i - lat_offset, swLng + j
					+ offset - lng_offset, weighted);
		}
		offset = (offset == 0.0 ? latset : 0.0);
	}

	return temp_data;
}

/*
 * Gets the data weight for a given point on the map by applying a weighted
 * average to the four nearest data points (or if fewer than four data points,
 * using all the ones available).
 */
function getDataWeight(hm_data, lat, lng) {
	var nearest = [];
	var nearest_distance = [];

	for (var i = 0; i < hm_data.length; i++) {
		if (nearest.length < 4) {
			// Trivial case; populate the first 4 nearest
			nearest.push(hm_data[i]);
			nearest_distance.push(distanceTo(lat, lng, hm_data[i].location
					.lat(), hm_data[i].location.lng()));
		} else {
			var dist_to_i = distanceTo(lat, lng, hm_data[i].location.lat(),
					hm_data[i].location.lng());
			var furthest_near_point = getArrayMax(nearest_distance);
			if (dist_to_i < furthest_near_point) {
				for (var j = 0; j < nearest_distance.length; j++) {
					if (nearest_distance[j] == furthest_near_point) {
						nearest[j] = hm_data[i];
						nearest_distance[j] = dist_to_i;
						break;
					}
				}
			}
		}
	}

	var final_weight = 0;
	var max_nearest_distance = getArrayMax(nearest_distance);
	/*
	 * var weight_max = nearest.reduce(function(a, b) { return Math.max(a,
	 * b.weight); }, 0); var dist_sum = nearest_distance.reduce(function(a, b) {
	 * return a + b; });
	 */
	for (var i = 0; i < nearest.length; i++) {
		final_weight += ((nearest[i].weight * (nearest_distance[i] / max_nearest_distance)) / 1.5);
		// final_weight += ((1 - (nearest_distance[i] / dist_sum))
		// * (nearest[i].weight / weight_max) / 1.5);
	}
	return (final_weight / (nearest.length));
}

/*
 * Find the distance from one provided point to another (assumes latitude and
 * longitude cover the same distance).
 */
function distanceTo(src_lat, src_lng, dest_lat, dest_lng) {
	var a = Math.pow((src_lat - dest_lat), 2);
	var b = Math.pow((src_lng - dest_lng), 2);

	return (Math.sqrt(a + b));
}

/*
 * Initializes heatmap with current basic settings.
 */
function initHeatmap(map) {
	var heatmap = new google.maps.visualization.HeatmapLayer({
		maxIntensity : 1,
		map : map,
		radius : MAX_DATA_WIDTH / Math.pow(2, (DEFAULT_ZOOM - LEAST_ZOOM))
				* 0.95,
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

	g_heatmap.set('radius', MAX_DATA_WIDTH
			/ Math.pow(2, (g_map.getZoom() - LEAST_ZOOM)) * 0.95);
	
	console.log("Points on map: " + hm_data.length);

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
 * Gets the maximum value in an array of numbers.
 */
function getArrayMax(number_array) {
	return Math.max.apply(null, number_array);
}

/*
 * Map setup entry point.
 */
google.maps.event.addDomListener(window, 'load', mapLoader);

/*
 * Map resize on window resize.
 */
google.maps.event.addDomListener(window, 'resize', function() {
	if (g_map) {
		var center = g_map.getCenter();
		google.maps.event.trigger(g_map, 'resize');
		g_map.setCenter(center);
	}
});
