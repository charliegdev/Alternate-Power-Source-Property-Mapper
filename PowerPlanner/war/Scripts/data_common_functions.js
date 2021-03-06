/*
 * Call this to update global data arrays based on raw data. Will process, interpolate,
 * and assign data to matching global array.
 * 
 * 	raw_data: unprocessed data from server
 * 	neLat, neLng: northeast geometric boundary coordinates of data to process
 * 	swLat, swLng: southwest geometric boundary coordinates of data to process
 * 	type: type of data to be processed; WIND, SOLAR, or HYDRO
 * 	season: season of data to be processed; can be anu, djf, mam, jja, son
 */
function updateData(raw_data, neLat, neLng, swLat, swLng, type, season) {
	var hm_data = [];
	_setHeatmapSize(type);
	processData(raw_data, hm_data, neLat, neLng, swLat, swLng, type, season);
	
	console.log("Data Points on Screen: " + hm_data.length);
	console.log("Scaler: " + scaler);
	console.log("Zoom: " + g_map.getZoom());
	
	if (POINT_DEBUGGER) {
		if (type == "WIND") {
			wind_data = hm_data;
		} else if (type == "SOLAR") {
			solar_data = hm_data;
		} else if (type == "HYDRO") {
			hydro_data = hm_data;
		}
	} else {
		console.time('_interpolateData');
		if (type == "WIND") {
			wind_data = _interpolateData(hm_data, neLat, neLng, swLat, swLng, type);
		} else if (type == "SOLAR") {
			solar_data = _interpolateData(hm_data, neLat, neLng, swLat, swLng, type);
		} else if (type == "HYDRO") {
			hydro_data = hm_data;
		}
		console.timeEnd('_interpolateData');
	}
}

/*
 * Call this to process raw data. Don't call it on a single point (i.e. with ne and 
 * sw bounds at the same location) so that you don't discard all real data points before
 * determining weights. Note that hydro data is processed differently because it is
 * interpolated by line, not by screen.
 * 
 * 	raw_data: unprocessed data from server
 * 	neLat, neLng: northeast geometric boundary coordinates of data to process
 * 	swLat, swLng: southwest geometric boundary coordinates of data to process
 * 	type: type of data to be processed; WIND, SOLAR, or HYDRO
 * 	season: season of data to be processed; can be anu, djf, mam, jja, son
 */
function processData(raw_data, hm_data, neLat, neLng, swLat, swLng, type, season) {
	var lat_offset = getLatOffset(neLat, swLat);
	var lng_offset = getLngOffset(neLng, swLng);
	set_scaler(type);
	
	var usable_data = [];
	_filterData(raw_data, usable_data,
			neLat + lat_offset,
			neLng + lng_offset,
			swLat - lat_offset,
			swLng - lng_offset,
			type, season);
	
	var weight_points = [];
	for (var i = 0; i < usable_data.length; i++) {
		weight_points.push(usable_data[i].weight);
	}
	var topval = getArrayMax(weight_points);
	var botval = getArrayMin(weight_points);

	console.log("Top val: " + topval);
	console.log("Bottom val: " + botval);
	
	// Hydro has to be interpolated at this point in order to retain meaning
	if (type == "HYDRO") {
		usable_data = _interpolateData(usable_data, neLat, neLng, swLat, swLng, type);
	}
	
	for (var i = 0; i < usable_data.length; i++) {
		addHeatmapCoord(hm_data, usable_data[i].lat, usable_data[i].lng,
				apply_scaler(usable_data[i].weight, botval, type));
	}
}

/*
 * Sets the global scaler value based on data type in order to bring data point values
 * down to roughly between 0.0 and 1.0 (though high outliers may still exist).
 * 
 * 	type: type of data (WIND, SOLAR, or HYDRO)
 */
function set_scaler(type) {
	if (type == "WIND") {
		scaler = WIND_SCALER;
	} else if (type == "SOLAR") {
		scaler = SOLAR_SCALER;
	} else if (type == "HYDRO") {
		scaler = HYDRO_SCALER;
	}
}

/*
 * Applies the current scaler to a data point to get a scaled data weight.
 * 
 * 	raw_weight: the instantaneous power potential of a point
 * 	offset: currently ignored (was used to drop lower bounds to zero)
 * 	type: type of data (WIND, SOLAR, or HYDRO)
 * 
 * 	returns: scaled data value
 */
function apply_scaler(raw_weight, offset, type) {
	var scaled = raw_weight / scaler;
	if (type == "SOLAR") {
		scaled = 2.5 * ((Math.pow(10, raw_weight))// - Math.pow(10, offset))
				/ Math.pow(10, scaler));
	}
	return scaled;
}

/*
 * Gets the instantaneous power potential of a point from its scaled data weight.
 * 
 * 	scaled: the scaled data weight of a point
 * 	scaler: the amount it was scaled by
 * 	offset: currently ignored (was used to offset dropped lower bounds)
 * 	type: type of data (WIND, SOLAR, or HYDRO)
 * 
 *  returns: raw data value
 */
function extract_raw_weight(scaled, scaler, offset, type) {
	var raw = scaled * scaler;
	if (type == "SOLAR") {
		raw = Math.log((scaled * Math.pow(10, scaler))/2.5)// + Math.pow(10, offset))
				/ Math.log(10);
	}
	return (raw > 0 ? raw : 0);
}

/*
 * Filters the data according to type. Common filters include removing points outside
 * the geometrics bounds and applying power calculations. Filtered data is pushed to
 * a new array.
 * 
 * 	raw_data: unprocessed data from server
 * 	push_data: array that will be filled with filtered data
 * 	neLat, neLng: northeast geometric boundary coordinates of data to process
 * 	swLat, swLng: southwest geometric boundary coordinates of data to process
 * 	type: type of data to be processed; WIND, SOLAR, or HYDRO
 * 	season: season of data to be processed; can be anu, djf, mam, jja, son
 */
function _filterData(raw_data, push_data, neLat, neLng, swLat, swLng, type, season) {
	if (type == "WIND") {
		_filterWindData(raw_data, push_data, neLat, neLng, swLat, swLng);
	} else if (type == "SOLAR") {
		_filterSolarData(raw_data, push_data);
	} else if (type == "HYDRO") {
		_filterHydroData(raw_data, push_data, neLat, neLng, swLat, swLng, season);
	}
}

/*
 * Interpolates values between the real data points based on data type and
 * zoom level. For wind at further out zoom levels, divides the screen into
 * a 3x3 grid and calls the main interpolation function. For hydro, calls the
 * bounded interpolation. Otherwise, calls the normal interpolation. Applies
 * an offset so that a small amount of off screen data is interpolated in order
 * to prevent aliasing at the edges. 
 * 
 *  hm_data: processed real data to be interpolated
 * 	neLat, neLng: northeast geometric boundary coordinates of data to process
 * 	swLat, swLng: southwest geometric boundary coordinates of data to process
 * 	type: type of data to be processed; WIND, SOLAR, or HYDRO
 * 
 * 	returns: array of interpolated values
 */
function _interpolateData(hm_data, neLat, neLng, swLat, swLng, type) {
	var lat_offset = (neLat - swLat) / 10;
	var lng_offset = (neLng - swLng) / 10;

	var lat_width = (neLat - swLat) + (2 * lat_offset);
	var lng_width = (neLng - swLng) + (2 * lng_offset);

	var lngset = MAX_DATA_WIDTH / Math.pow(2, (g_map.getZoom() - LEAST_ZOOM));
	var latset = lngset / 2;
	var offset = latset;

	var temp_data = [];

	if (type == "WIND") {
		if (view_state != OVER_VIEW) {
			_createInterpolation(hm_data, temp_data, lat_width, lng_width,
					swLat - lat_offset, swLng - lng_offset, latset, lngset,
					offset, type);
		} else {
			var d_lat_offset = getLatOffset(neLat, swLat);
			var d_lng_offset = getLngOffset(neLng, swLng);
			var data_bins = _binData(hm_data, neLat, neLng, swLat, swLng,
					d_lat_offset, d_lng_offset);

			var lat_increment = lat_width / 3;
			lat_increment += latset - (lat_increment % latset);
			var lng_increment = lng_width / 3;
			lng_increment -= lng_increment % lngset;
			var BIN_SIZE = 3;

			var lat_start = swLat - lat_offset;
			var lng_start = swLng - lng_offset;
			for (var lngbin = 0; lngbin < BIN_SIZE; lngbin++) {
				for (var latbin = 0; latbin < BIN_SIZE; latbin++) {
					var hm_bin = data_bins[latbin][lngbin].concat(
							data_bins[latbin][lngbin + 1]).concat(
									data_bins[latbin + 1][lngbin]).concat(
											data_bins[latbin + 1][lngbin + 1]);
					var next_inter = _createInterpolation(hm_bin, temp_data,
							lat_increment, lng_increment, lat_start, lng_start,
							latset, lngset, offset, type);
					lat_start = next_inter.next_lat + latset;
				}
				lat_start = swLat - lat_offset;
				lng_start = _getLngBound(lngset, lng_start + lng_increment) + lngset; 
			}
		}
	} else if (type == "HYDRO") {
		_boundedInterpolation(hm_data, temp_data);
	} else {
		_createInterpolation(hm_data, temp_data, lat_width, lng_width,
				swLat - lat_offset, swLng - lng_offset, latset, lngset, 
				offset, type);
	}

	return temp_data;
}

/*
 * Creates an interpolation that does not fill the entire screen. Requires a 
 * particular data format to accomplish, which is currently only supported by 
 * HYDRO data. Finds points of data in the same 'points' set; if these points 
 * are far enough apart, creates a line interpolation between them. Interpolated 
 * data is added to a provided array.
 * 
 *  hm_data: processed real data to be interpolated
 *  fill_data: array to populate with interpolated data
 */
function _boundedInterpolation(hm_data, fill_data) {
	var diam = MAX_DATA_WIDTH / Math.pow(2, (g_map.getZoom() - LEAST_ZOOM)) * 0.08;
	for (var i = 0; i < hm_data.length; i++) {
		if (hm_data[i].weight > 0) {
			var curr_point = hm_data[i].points[0];
			fill_data.push({
				lat : hm_data[i].points[0].lat,
				lng : hm_data[i].points[0].lon,
				weight : hm_data[i].weight
			});
			for (var j = 1; j < hm_data[i].points.length; j++) {
				var dist = distanceTo(curr_point.lat, curr_point.lon, 
						hm_data[i].points[j].lat, hm_data[i].points[j].lon);
				if (dist > diam) {
					_lineInterpolation(fill_data, curr_point, hm_data[i].points[j], 
								dist, diam, hm_data[i].weight);
					curr_point = hm_data[i].points[j];
					fill_data.push({
						lat : hm_data[i].points[j].lat,
						lng : hm_data[i].points[j].lon,
						weight : hm_data[i].weight
					});
				} 
			}
		}
	}
}

/*
 * Interpolates a line between two points.
 * 
 *  fill_data: array to populate with interpolated data
 *  start_point: geometric point at start of line (object with lat/lon properties)
 *  end_point: geometric point at end of line (object with lat/lon properties)
 *  distance: distance between points
 *  diameter: diameter of heatmap point being added
 *  weight: weight of data point
 */
function _lineInterpolation(fill_data, start_point, end_point, distance, diameter, weight) {
	var dist_remaining = distance - diameter;
	var start_lat = start_point.lat;
	var start_lon = start_point.lon;
	var end_lat = end_point.lat;
	var end_lon = end_point.lon;
	
	while (dist_remaining > diameter) {
		var new_lat = start_lat + (end_lat - start_lat) * (diameter / distance);
		var new_lon = start_lon + (end_lon - start_lon) * (diameter / distance);
		
		fill_data.push({
			lat : new_lat,
			lng : new_lon,
			weight : weight
		});
		
		start_lat = new_lat;
		start_lon = new_lon;
		
		dist_remaining -= diameter;
	}
}

/*
 * Fills in a grid of all the points visible on the screen as defined by the
 * provided lat/lng widths, beginning from the specified start points and
 * incrementing by the specified lat/lng set values. Applies a specified offset
 * to every other longitudinal row.
 * 
 *  hm_data: processed real data to be interpolated
 *  fill_data: array to populate with interpolated data
 *  lat_width: width of latitude to fill with interpolated points
 *  lng_width: width of longitude to fill with interpolated points
 *  lat_start, lng_start: geometric point to begin interpolation at
 *  latset: latitudinal increments to interpolate by
 *  lngset: longitudinal increments to interpolate by
 *  offset: increment to offset longitude by (to prevent grid appearance of heatmap)
 * 	type: type of data to be processed; WIND, SOLAR, or HYDRO
 * 
 * 	returns: an object containing the next latitude (next_lat) and next longitude
 *  (next_lng) that would be placed
 */
function _createInterpolation(hm_data, fill_data, lat_width, lng_width,
		lat_start, lng_start, latset, lngset, offset, type) {
	var curr_offset = (getIsOffset(lngset, lng_start) ? latset : 0.0);
	var max_lat = -90;
	var max_lng = -180;
	
	var safeLatStart = _getLatBound(latset, lat_start);
	var safeLatEnd = _getLatBound(latset, lat_start + lat_width);
	var safeLngStart = _getLngBound(lngset, lng_start);
	var safeLngEnd = _getLngBound(lngset, lng_start + lng_width);

	for (var i = safeLatStart; i < safeLatEnd; i += latset) {
		for (var j = safeLngStart; j < safeLngEnd; j += lngset) {
			var lat_point = i;
			var lng_point = j + curr_offset;
			var weighted = getDataWeight(hm_data, lat_point, lng_point, type);
			if (weighted > MIN_DISPLAY_WEIGHT) {
				addHeatmapCoord(fill_data, lat_point, lng_point, weighted);
			}
		}
		curr_offset = (curr_offset == 0.0 ? latset : 0.0);
	}

	return {
		next_lat : safeLatEnd,
		next_lng : safeLngEnd
	};
}

/*
 * For heatmap consistency, gets the latitude point closest to the desired
 * latitude without going over.
 * 
 * 	incr: size of heatmap points
 * 	desired: desired latitude point to add interpolation to
 * 
 * 	returns: the actual latitude point to add interpolation to
 */
function _getLatBound(incr, desired) {
	return getSafeBound(incr, -90, desired);
}

/*
 * For heatmap consistency, gets the longitude point closest to the desired
 * longitude without going over.
 * 
 * 	incr: size of heatmap points
 * 	desired: desired longitude point to add interpolation to
 * 
 * 	returns: the actual longitude point to add interpolation to
 */
function _getLngBound(incr, desired){
	return getSafeBound(incr, -180, desired);
}

/*
 * For heatmap consistency (and to avoid a grid-like pattern on heatmap), checks
 * if the current longitude should have an offset applied.
 * 
 * 	incr: size of heatmap points
 * 	desired: desired longitude point to know if offset should be applied
 * 
 * 	returns: true if offset should be applied; otherwise, false
 */
function getIsOffset(incr, desired) {
	var ret_val = false;
	var incr_val = -180;
	while (incr_val < desired) {
		incr_val += incr;
		ret_val = !ret_val;
	}
	return ret_val;
}

/*
 * For heatmap consistency, gets the point closest to the desired one
 * without going over.
 * 
 * 	incr: size of heatmap points
 * 	start: the point to begin counting from
 * 	desired: desired latitude point to add interpolation to
 * 
 * 	returns: the actual point to add interpolation to
 */
function getSafeBound(incr, start, desired) {
	var ret_val = start;
	while (ret_val + incr < desired) {
		ret_val += incr;
	}
	return ret_val;
}

/*
 * Takes in an array of real data points, map boundary points, and offset
 * distances for latitude and longitude. Separates data points into a 4x4 matrix
 * that evenly divides up the boundary size (with offsets added to all sides).
 * 
 *  hm_data: processed real data to be interpolated
 * 	neLat, neLng: northeast geometric boundary coordinates of data to process
 * 	swLat, swLng: southwest geometric boundary coordinates of data to process
 * 	data_lat_offset: latitude offset to apply to bounds
 *  data_lng_offset: longitude offset to apply to bounds
 * 
 * 	returns: 4x4 matrix (array of 4 arrays each holding 4 arrays) with data cut 
 * 	into bins
 */
function _binData(hm_data, neLat, neLng, swLat, swLng, data_lat_offset,
		data_lng_offset) {
	var BIN_SIZE = 4;
	var data_bins = [];
	for (var i = 0; i < BIN_SIZE; i++) {
		data_bins[i] = new Array(BIN_SIZE);
		for (var j = 0; j < BIN_SIZE; j++) {
			data_bins[i][j] = [];
		}
	}
	var lat_width = (neLat - swLat) + 2 * data_lat_offset;
	var lng_width = (neLng - swLng) + 2 * data_lng_offset;
	var southLat = swLat - data_lat_offset;
	var westLng = swLng - data_lng_offset;

	var error_state = false;
	for (var i = 0; i < hm_data.length; i++) {
		var lat_bin = 0;
		var lng_bin = 0;
		var curr_lat = southLat + (lat_width / 4);
		var curr_lng = westLng + (lng_width / 4);

		while (hm_data[i].location.lat() > curr_lat) {
			curr_lat += (lat_width / 4);
			lat_bin++;
			if (lat_bin > 3) {
				console.log("ERROR: data point failed to fit into a bin (lat failure)");
				error_state = true;
				break;
			}
		}
		if (error_state) {
			error_state = false;
			break;
		}

		while (hm_data[i].location.lng() > curr_lng) {
			curr_lng += (lng_width / 4);
			lng_bin++;
			if (lng_bin > 3) {
				console.log("ERROR: data point failed to fit into a bin (lng failure)");
				error_state = true;
				break;
			}
		}
		if (error_state) {
			error_state = false;
			break;
		}

		data_bins[lat_bin][lng_bin].push(hm_data[i]);
	}

	for (var i = 0; i < data_bins.length; i++) {
		for (var j = 0; j < data_bins[i].length; j++) {
			console.log("Bin size[" + i + "][" + j + "]: "
					+ data_bins[i][j].length);
		}
	}

	return data_bins;
}

/*
 * Find the distance from one provided point to another (assumes latitude and
 * longitude cover the same distance).
 * 
 * 	src_lat, src_lng: geometric starting point
 * 	dest_lat, dest_lng: geometric ending point
 * 
 * 	returns: distance between starting and ending points
 */
function distanceTo(src_lat, src_lng, dest_lat, dest_lng) {
	var a = Math.pow((src_lat - dest_lat), 2);
	var b = Math.pow((src_lng - dest_lng), 2);

	return (Math.sqrt(a + b));
}

/*
 * Returns if the distance from the lat, lng value is less than the current radius
 * of the heatmap spots away from the lat and lng of a point.
 */
function pointIsOnPoint(lat, lng, point_lat, point_lng) {
	return distanceTo(lat, lng, point_lat, point_lng) <= (getHeatmapSize("HYDRO") * 2) ?
			true : false;
}

/*
 * Gets the weight of the data at the specified geometric point.
 * 
 *  hm_data: processed real data
 *  lat, lng: geometric point to get weight of
 *  type: type of power to get weight of point from
 *  
 *  returns: interpolated point weight
 */
function getDataWeight(hm_data, lat, lng, type) {
	var weight_val = 0;
	if (type == "WIND") {
		weight_val = _getDataWeightWind(hm_data, lat, lng);
	} else if (type == "SOLAR") {
		weight_val = _getDataWeightSolar(hm_data, lat, lng);
	} else if (type == "HYDRO") {
		weight_val = _getDataWeightHydro(hm_data, lat, lng);
	}

	if (weight_val > 3.5) {
		weight_val = 3.5;
	}
	return weight_val;
}

/*
 * Create a point data object based on a marker. Used to synchronize server calls and
 * provide data to a marker's info window.
 * 
 * 	marker: a marker from Google Maps API
 *
 *	returns: a point data object
 */
function getPointData(marker) {
	return pointDataObj = {
			marker : marker,
			lat : marker.getPosition().lat(),
			lng : marker.getPosition().lng(),
			wind_raw : null,
			solar_raw : null,
			hydro_raw : null
	};
}

/*
 * Function for fetching and displaying power potential values in a marker's info window.
 * First searches for locally displayed data, then checks the cache if the data is not
 * already displayed, and finally will asynchronously launch a server query to retrieve 
 * the data on a cache miss. Each power type will attempt to populate the 'Total Energy'
 * field as well, but only the last of the three will succeed in updating it.
 * 
 * 	pointDataObj: the object that holds the values for a marker's point location
 * 	and power potentials
 * 	uniq_id: html id for updating a marker's info window
 */
function populatePointData(pointDataObj, uniq_id) {
	var offset = 0.05;
	
	var neLat = pointDataObj.lat + offset;
	var neLng = pointDataObj.lng + offset;
	var swLat = pointDataObj.lat - offset;
	var swLng = pointDataObj.lng - offset;
	
	var season = getSeason($("#wind-seasonal").val());

	if (wind_data.length) {
		pointDataObj.wind_raw = _getDataWeightWind(wind_data, pointDataObj.lat, pointDataObj.lng)
			* WIND_SCALER * HOUR_TO_YEAR;
		$("#" + uniq_id + " .windstring").html(pointDataObj.wind_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	} else if (checkCache(neLat, neLng, swLat, swLng, "WIND", season)) {
		var hm_data = [];
		var raw_data = fetchFromCache(pointDataObj.lat, pointDataObj.lng, 
				pointDataObj.lat, pointDataObj.lng, "WIND", season);
		processData(raw_data, hm_data, neLat, neLng, swLat, swLng, "WIND", season);
		pointDataObj.wind_raw = _getDataWeightWind(hm_data, pointDataObj.lat, pointDataObj.lng)
			* WIND_SCALER * HOUR_TO_YEAR;
		$("#" + uniq_id + " .windstring").html(pointDataObj.wind_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	} else {
		queryAndCallback(season, neLat, neLng, swLat, swLng, 0, 0, "WIND", function(data) {
			var hm_data = [];
			processData(data, hm_data, neLat, neLng, swLat, swLng, "WIND", season);
			pointDataObj.wind_raw = _getDataWeightWind(hm_data, pointDataObj.lat, pointDataObj.lng)
				* WIND_SCALER * HOUR_TO_YEAR;
			$("#" + uniq_id + " .windstring").html(pointDataObj.wind_raw.toFixed(2).toString());
			_tryPopulateTotalEnergy(pointDataObj, uniq_id);
		});
	}
	
	if (solar_data.length) {
		pointDataObj.solar_raw = 
			extract_raw_weight(_getDataWeightSolar(solar_data, pointDataObj.lat, pointDataObj.lng), 
			SOLAR_SCALER, SOLAR_BOTTOM, "SOLAR") * HOUR_TO_YEAR;
		$("#" + uniq_id + " .solarstring").html(pointDataObj.solar_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	} else if (checkCache(neLat, neLng, swLat, swLng, "SOLAR", season)) {
		var hm_data = [];
		var raw_data = fetchFromCache(pointDataObj.lat, pointDataObj.lng,
				pointDataObj.lat, pointDataObj.lng, "SOLAR", season);
		processData(raw_data, hm_data, neLat, neLng, swLat, swLng, "SOLAR", season);
		pointDataObj.solar_raw = 
			extract_raw_weight(_getDataWeightSolar(hm_data, pointDataObj.lat, pointDataObj.lng), 
			SOLAR_SCALER, SOLAR_BOTTOM, "SOLAR") * HOUR_TO_YEAR;
		$("#" + uniq_id + " .solarstring").html(pointDataObj.solar_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	} else {
		queryAndCallback(season, neLat, neLng, swLat, swLng, 0, 0, "SOLAR", function(data) {
			var hm_data = [];
			processData(data, hm_data, neLat, neLng, swLat, swLng, "SOLAR", season);
			pointDataObj.solar_raw = 
				extract_raw_weight(_getDataWeightSolar(hm_data, pointDataObj.lat, pointDataObj.lng), 
				SOLAR_SCALER, SOLAR_BOTTOM, "SOLAR") * HOUR_TO_YEAR;
			$("#" + uniq_id + " .solarstring").html(pointDataObj.solar_raw.toFixed(2).toString());
			_tryPopulateTotalEnergy(pointDataObj, uniq_id);
		});
	}
	if (hydro_data.length) {
		pointDataObj.hydro_raw = _getDataWeightHydro(hydro_data, pointDataObj.lat, pointDataObj.lng)
			* HYDRO_SCALER * HOUR_TO_YEAR;
		$("#" + uniq_id + " .hydrostring").html(pointDataObj.hydro_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	} else if (checkCache(neLat, neLng, swLat, swLng, "HYDRO", season)) {
		var hm_data = [];
		var raw_data = fetchFromCache(pointDataObj.lat, pointDataObj.lng,
				pointDataObj.lat, pointDataObj.lng, "HYDRO", season);
		processData(raw_data, hm_data, neLat, neLng, swLat, swLng, "HYDRO", season);
		pointDataObj.hydro_raw = _getDataWeightHydro(hm_data, pointDataObj.lat, pointDataObj.lng)
			* HYDRO_SCALER * HOUR_TO_YEAR;
		$("#" + uniq_id + " .hydrostring").html(pointDataObj.hydro_raw.toFixed(2).toString());
		_tryPopulateTotalEnergy(pointDataObj, uniq_id);
	}  else {
		queryAndCallback(season, neLat, neLng, swLat, swLng, 0, 0, "HYDRO", function(data) {
			var hm_data = [];
			processData(data, hm_data, neLat, neLng, swLat, swLng, "HYDRO", season);
			pointDataObj.hydro_raw = _getDataWeightHydro(hm_data, pointDataObj.lat, pointDataObj.lng)
				* HYDRO_SCALER * HOUR_TO_YEAR;
			$("#" + uniq_id + " .hydrostring").html(pointDataObj.hydro_raw.toFixed(2).toString());
			_tryPopulateTotalEnergy(pointDataObj, uniq_id);
		});
	}
}

/*
 * If all the energy types of a pointDataObj have a value, populate the total
 * energy and change the marker's icon.
 * 
 * 	pointDataObj: the object that holds the values for a marker's point location
 * 	and power potentials
 * 	uniq_id: html id for updating a marker's info window
 */
function _tryPopulateTotalEnergy(pointDataObj, uniq_id) {
	if (pointDataObj.wind_raw != null && 
			pointDataObj.solar_raw != null && 
			pointDataObj.hydro_raw != null) {
		var totalEnergy = pointDataObj.wind_raw + pointDataObj.solar_raw + 
			pointDataObj.hydro_raw;
		$("#" + uniq_id + " .totalstring").html(totalEnergy.toFixed(2).toString());
		
		// when all energy types have a value, change the marker's icon.
		changeMarkerIcon(pointDataObj.marker, totalEnergy/11000);
		
	}
}

/*
 * Get season's representative index.
 * 
 * 	season: season string; can be one of anu, djf, mam, jja, son
 * 
 * 	returns: corresponding index from 0 to 4
 */
function parseSeason(season) {
	var season_index = 0;
	switch(season) {
	case "anu": season_index = 0; break;
	case "djf": season_index = 1; break;
	case "mam": season_index = 2; break;
	case "jja": season_index = 3; break;
	case "son": season_index = 4; break;
	}
	return season_index;
}

/*
 * Get season's representative string based on season name.
 * 
 * 	val: one of spring, summer, fall, winter
 * 
 * 	returns: season string; either mam, jja, son, djf, or anu (default)
 */
function getSeason(val) {
	var season = 'anu';
	switch(val) {
	case "spring": season = "mam"; break;
	case "summer": season = "jja"; break;
	case "fall": season = "son"; break;
	case "winter": season = "djf"; break;
	}
	console.log("season: " + season);
	return season;
}
