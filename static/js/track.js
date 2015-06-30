
// Initialize tabs
$(document).ready(function() {

    $('.tabs').tab();

    $('#audio-widget').bind('timeupdate', function() { 
        track_progress(this.currentTime);
    });
});

// Retrieve the analysis object
$.ajax({
    url: "/analysis/" + $("#track_id").val(),
    dataType: "json"
}).done(process_analysis);

// array container for brush updates
// var brush_updates       = [];
var progress_updates    = [];

var beat_times          = null;
var last_beat           = null;


// Update position for audio widget
function track_progress(time) {

    if (beat_times == null) {
        return;
    }

    // find the current beat
    var current_beat = last_beat;

    for (var b = last_beat; b < beat_times.length; b++) {
        if (beat_times[b] > time) {
            current_beat = b - 1;
            break;
        }
    }

    last_beat = current_beat;

    // return early if the current beat hasn't changed
    progress_updates.forEach(function(update) {
        update(time);
    });
}

// Minute:second string formatter
function num_to_time(x) {
    var mins = Math.floor(x / 60);
    var secs = Math.round(x % 60);

    return d3.format('2d')(mins) + ':' + d3.format('02d')(secs);
}

function get_colors(cmap) {
    var c = [$('body').css('background-color')];
    return c.concat(cmap);
}

function format_pitch_class(d) {

    var major_scale = {0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B'};
    d = parseInt(d);

    if (d in major_scale) {
        return major_scale[d];
    }

    return null;
}

function format_pitches(d) {

    var notes = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F',
    'A', 'A\u266F', 'B'];

    d = parseInt(d);

    octave = 1 + Math.floor(d / 12);

    return notes[d % 12] + octave;
}


// Render the analysis widgets
function process_analysis(analysis) {

    // Push a phantom beat at 0
    if (analysis['beats'][0] > 0) {
        analysis['beats'].unshift(0.0);
    }
    // extend the beat array to cover the entire track duration
    if (analysis['beats'][-1] < analysis['duration']) {
        analysis['beats'].push(analysis['duration']);
    }

    /* Reset the beat time registry */
    beat_times  = analysis['beats'];
    last_beat   = 0;

    // Header info
    draw_meta( analysis );

    // Draw the structure bundle
    draw_structure(analysis['beats'], analysis['links'], analysis['segments'], '#structplot');
}

function draw_meta(values) {

    var title   = 'n/a';
    var artist  = 'n/a';
    var album   = '';

    if (values['title'])    {  title = values['title'];      }
    if (values['artist'])   {  artist = values['artist'];    }

    $("#track_title").text(title);
    $("#track_artist").text(artist);

    document.title = '[Seymour] ' + artist + ' - '  + title;
}


function draw_zoom(signal, duration) {
    var real_time = d3.scale.linear()
                        .domain([0, signal.length])
                        .range([0, duration]);

    var margin  = {left: 60, right: 0, top: 0, bottom: 20},
        width   = $('.plot').width() - margin.left - margin.right,
        height  = $('.zoomwindow').height() - margin.top - margin.bottom;


    var x = d3.scale.linear().range([0, width]).domain([0, duration]);
    var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .tickFormat(num_to_time);

    var y = d3.scale.linear().range([height, 0]).domain(d3.extent(signal));
    var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient('left');

    var my_values = [];
    for (var i = 0; i < signal.length; i++) {
        my_values.push({t: real_time(i), v: signal[i]});
    }


    var line = d3.svg.line()
                .x(function(d) { return x(d.t); })
                .y(function(d) { return y(d.v); });

    var svg  = d3.select("#signal").append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    
    svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0, ' + height + ')')
            .call(xAxis);
    
    svg.append('path')
            .datum(my_values)
            .attr('class', 'line')
            .attr('d', line);


    /*
    var brush = d3.svg.brush()
        .x(x)
        .on('brush', _brushed);

    function _brushed() {
        brush_updates.forEach(function(update) { 
            update(brush.empty() ? x.domain() : brush.extent());
        } );
    }

    svg.append("g")
      .attr("class", "x brush")
      .call(brush)
    .selectAll("rect")
      .attr("y", 0)
      .attr("height", height);
    */
    var marker = svg.append('g');
    
    marker.append('line')
                .attr('x1', 0).attr('x2', 0)
                .attr('y1', 0).attr('y2', height)
                .attr('class', 'marker');

    function update(xpos) {
        marker.attr('transform', 'translate(' + x(xpos) + ',0)');
    }
    update(0);
    progress_updates.push(update);
}

function draw_line(values, beats, target, range) {
    

    var margin  = {left: 60, right: 0, top: 20, bottom: 20},
        width   = $('.plot').width() - margin.left - margin.right,
        height  = $('.lines').height() - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]);
    var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .tickFormat(num_to_time);

    var y = d3.scale.linear().range([height, 0]);
    var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient('left')
                    .ticks(5);

    var my_values = [];
    for (var i = 0; i < values.length; i++) {
        my_values.push({t: beats[i], v: values[i]});
    }
    // dupe the last value to span the full range
    my_values.push({t: beats[beats.length-1], v: values[values.length-1]});

    y.domain( range || d3.extent(my_values, function(d) { return d.v; }));

    var line = d3.svg.line()
                .interpolate('monotone')
                .x(function(d) { return x(d.t); })
                .y(function(d) { return y(d.v); });

    var svg     = d3.select(target).append('svg')
                    .attr('width', width + margin.left + margin.right)
                    .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0, ' + height + ')');

    svg.append('g')
            .attr('class', 'y axis')
            .call(yAxis);

    svg.append("defs").append("clipPath").attr("id", "clip")
        .append("rect")
            .attr("width", width)
            .attr("height", height);

    var zoomable = svg.append('path')
            .datum(my_values)
            .attr("clip-path", "url(#clip)")
            .attr('class', 'line');

    function update(domain) {
        x.domain(domain);
        svg.select('.x.axis').call(xAxis);
        zoomable.attr('d', line);
    }
    update(d3.extent(beats)); 

//     brush_updates.push(update);
}

function flatten(X) {

    var flat = []
    for (var i = 0; i < X.length; i++) {
        for (var j = 0; j < X[i].length; j++) {
            flat.push(X[i][j]);
        }
    }
    return flat;
}

function draw_heatmap(features, beats, target, colormap, range, y_formatter, num_ticks) {

    var margin = {left: 60, top: 0, right: 0, bottom: 40},
        width   = $('.plot').width() - margin.left - margin.right,
        height  = $('.heatmap').height() - margin.top - margin.bottom;

    var n_bins = features[0].length;


    var color = d3.scale.linear()
        .domain(range   || d3.extent(flatten(features)))
        .range(colormap || [$('body').css('background'), colorbrewer.Purples[3].slice(-1)[0]])
        .interpolate(d3.interpolateLab);

    var x = d3.scale.linear()
                .range([0, width])
                .domain(d3.extent(beats));

    var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .tickFormat(num_to_time);

    var y = d3.scale.linear()
                .range([height, 0])
                .domain([0, n_bins]);

    var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient('left')
                    .tickFormat(y_formatter || d3.format('.0f'))
                    .ticks(num_ticks || 5);

    var svg = d3.select(target)
                .append('svg')
                    .attr('width', width + margin.left + margin.right)
                    .attr('height', height + margin.top + margin.bottom)
                .append('g')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + (height + margin.top) + ')');

    svg.append('g')
            .attr('class', 'y axis')
            .call(yAxis)
            .attr('transform', 'translate(0,' + (margin.top - y(n_bins - 0.5)) + ')')
            .attr('font-size', '6pt');


    svg.append("defs")
        .append("clipPath")
            .attr("id", "clip")
        .append("rect")
            .attr("width", width)
            .attr("height", height);

    var zoomers = svg.append('g').attr('clip-path', 'url(#clip)');
    var cols = [];

    for (var i = 0; i < beats.length-1; i++) {

        var my_data = { time:   beats[i], 
                        width:  x(beats[i+1] - beats[i]), 
                        values: features[i]};

        cols.push(my_data);

        var beat_stack = zoomers.append('g').datum(my_data)
                            .attr('class', 'heatmap-bar')
                            .attr('transform', 'translate(' + x(my_data.time) + ', 0)');// scale(1, 1)');

        for (var j = 0; j < n_bins; j++) {
            beat_stack.append('rect')
                    .attr('x', 0)
                    .attr('width', my_data.width)
                    .attr('y', y(j + 1))
                    .attr('height', Math.abs(y(1) - y(0)))
                    .style('fill', color(features[i][j]))
                    .style('stroke', color(features[i][j]));
        }

    }

    var extent = d3.extent(beats);
    function update(domain) {
        var scale = (extent[1] - extent[0]) / (domain[1] - domain[0]);

        x.domain(domain);
        svg.select('.x.axis').call(xAxis);

        svg.selectAll('.heatmap-bar')
                .attr('transform', function(d) { 
                    return 'translate(' + x(d.time) + ', 0)';// scale(' + scale + ', 1)'; 
                } );
    }
    update(extent);

//     brush_updates.push(update);

    var col_ids = d3.range(cols.length);
    col_ids.push(cols.length-1);
    col_ids.unshift(0);
    var time_to_column_id   = d3.scale.threshold()
                                .domain(cols.map(function(d) { return d.time; }))
                                .range(col_ids);

    var marker = zoomers.append('rect')
                    .attr('class', 'heatmap-bar')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('height', d3.max(y.range()))
                    .style('fill', 'red')
                    .style('fill-opacity', '0.5')
                    .style('stroke', 'none');

    function update_marker(xpos) {
        var scale = (extent[1] - extent[0]) / (x.domain()[1] - x.domain()[0]);

        var b = cols[time_to_column_id(xpos)];

        marker.datum(b);
        marker.attr('transform', 'translate(' + x(b.time) + ',0) scale(' + scale + ',1)')
            .attr('width', b.width);
    }
    update_marker(0);
    progress_updates.push(update_marker);
}

function draw_structure(beats, beat_links, all_segments, target) {

    var margin = {left: 60, right: 0, top: 0, bottom: 0};
    var diameter = $('#structplot').width() - margin.left - margin.right;

    var radius = diameter / 2;
    var radius_i = 16;

    var svg = d3.select(target).append('svg')
                    .attr("width", diameter + margin.left + margin.right)
                    .attr("height", diameter + margin.top + margin.bottom)
                .append('g')
                    .attr(  'transform', 
                            'translate(' + (radius + margin.left) + ',' + (radius + margin.top) + ')');

    var cluster = d3.layout.cluster()
                    .size([360, radius])
                    .sort(null)
                    .value(function(d) { return d.size; });

//    var colors = d3.scale.category20c();
//    var colors = colorbrewer.Set3[9];
    var colors = colorbrewer.Paired[12];
    // Build the nodes: root -> segments -> beats

    function highlight(level, value) {

        return function() {
            var arcs = d3.selectAll('[level="' + level + '"]');


            if (value) {
                arcs.style('fill-opacity', 1.0);
            } else {
                arcs.style('fill-opacity', 0.75);
            }
            
//             d3.selectAll('path').style('stroke', 'none');
//             var label = $(this).attr('label');
//             var my_arcs = d3.selectAll('[level="' + level + '"][label="' + label + '"]');
//             my_arcs.style('stroke', 'white')
//                     .style('stroke-width', '4px')
//                     .style('stroke-opacity', 1.0);

        }
    }

    function build_nodes(segments, level) {

        var map = {};
        function new_node(name) {
            if (! map[name]) {
                map[name] = {name: name, children: [], key: name, leaf: false};
            }
        }

        // push the root
        new_node('');

        // push each segment
        for (var i = 0; i < segments.length; i++) {
            var node_name = 'segment_' + i

            new_node(node_name);
            map[node_name].parent = map[''];
            map[''].children.push(map[node_name])

            d3.range(segments[i], segments[i+1] || beats.length).forEach(function(b) {
                var beat_name = 'beat_' + level + '_' + b;
                
                new_node(beat_name);
                map[beat_name].parent   = map[node_name];
                map[beat_name].segment  = i;
                map[beat_name].time     = beats[b];
                map[beat_name].beat_num = b;
                map[beat_name].leaf     = true;

                map[node_name].children.push(map[beat_name]);
            });
        }
        return map[''];
    }

    for (var segment_level = 0; segment_level < all_segments.length; segment_level++) {

        var segments = all_segments[segment_level]['boundaries'];
        var labels   = all_segments[segment_level]['labels'];

        var nodes = cluster.nodes(build_nodes(segments), segment_level);

        function time_skip(segments, idx) {
            return function(g, i) {
                var beat_id = segments[idx];
    
                console.log('Skip to time: ' + beats[beat_id]);
                $('#audio-widget')[0].currentTime = beats[beat_id];


                d3.selectAll('path').style('stroke', 'none');
                var level = $(this).attr('level');
                var label = $(this).attr('label');
                var my_arcs = d3.selectAll('[level="' + level + '"][label="' + label + '"]');
                my_arcs.style('stroke', 'white')
                        .style('stroke-width', '4px')
                        .style('stroke-opacity', 1.0);

            };
        }

        var arcs = svg.append('g');

        var segment_width = 35 - 2 * segment_level;

        for (var j = 0; j < labels.length; j++) {
            // get the extent
            var angles = nodes.filter(function(n) { return n.segment == j; }).map(function(n) {
                return n.x;
            });

            var end_angle = 360.0;
            var end_angles = nodes.filter(function(n) { 
                    return n.segment == j + 1;
                }).map(function(n) {
                    return n.x;
                });

            if (end_angles.length > 0) {
                end_angle = end_angles[0];
            }

            var segment_arc = d3.svg.arc()
                        .startAngle(angles[0]/ 180.0 * Math.PI)
                        .endAngle(end_angle / 180.0 * Math.PI)
                        .padRadius(0)
                        .innerRadius(radius_i)
                        .outerRadius(radius_i + segment_width);
                    
            arcs.append('path')
                .attr('d', segment_arc)
                .style('fill', colors[labels[j]])
                .style('fill-opacity', 0.75)
                .attr('level', segment_level)
                .attr('label', labels[j])
                .attr('start_time', beats[segments[j]])
                .on('mouseenter', highlight(segment_level, true))
                .on('mouseleave', highlight(segment_level, false))
                .on("click", time_skip(segments, j));
        }
//         arcs.on('mouseenter', highlight(segment_level, true))
//             .on('mouseleave', highlight(segment_level, false));

        radius_i = radius_i + segment_width + 1;
    }

    // time -> beat -> angle

    var beat_to_angle = nodes.filter(function(n) { return n.leaf; }).map(function(n) {
        return {beat_time: n.time, angle: n.x};
    });

    var time_to_angle = d3.scale.linear()
                            .domain(beat_to_angle.map(function(b) { return b.beat_time; }))
                            .range(beat_to_angle.map(function(b) { return b.angle; }));

    var marker = svg.append('g');
    marker.append('line')
                .attr('x1', 0).attr('x2', 0)
                .attr('y1', -radius_i).attr('y2', 0)
                .attr('class', 'marker');

    function update(xpos) {
        marker.attr('transform', 'rotate(' + time_to_angle(xpos) + ')');
    }
    update(0);
    progress_updates.push(update);
}

