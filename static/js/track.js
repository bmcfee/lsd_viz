
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
    draw_structure(analysis['beats'], analysis['segments'], '#structplot');
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

function draw_structure(beats, all_segments, target) {

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

    var colors = colorbrewer.Paired[10];
    // Build the nodes: root -> segments -> beats

    function highlight(level, value) {

        return function() {
            var arcs = d3.selectAll('[level="' + level + '"]');

            if (value) {
                arcs.style('fill-opacity', 1.0);
            } else {
                arcs.style('fill-opacity', 0.75);
            }
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

