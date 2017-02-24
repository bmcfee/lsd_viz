
// Initialize tabs
$(document).ready(function() {

    $('.tabs').tab();

    $('#audio-widget').bind('timeupdate', function() { 
        track_progress(this.currentTime);
    });
});

// Retrieve the analysis object
$.ajax({
    url: "/analysis",
    dataType: "json"
}).done(draw_structure);

var progress_updates    = [];
var beat_times          = null;
var last_beat           = null;


// Update position for audio widget
function track_progress(time) {
    progress_updates.forEach(function(update) {
        update(time);
    });
}

function draw_structure(all_segments) {

    var target = '#structplot';

    var margin = {left: 60, right: 0, top: 0, bottom: 0};
    
    var diameter = $(target).width() - margin.left - margin.right;

    var radius = diameter / 2;
    var radius_i = 16;

    // Get the duration of the track
    // all_segments[0] = the whole track
    // all_segments[0][0] = the interval list
    // all_segments[0][0][0] = the first (only) interval
    // ..[1] = the end time of the interval
    var duration = all_segments[0][0][0][1];

    var time_to_angle = d3.scale.linear()
                            .domain([0, duration])
                            .range([0, 360]);

    var time_to_rad = d3.scale.linear()
                            .domain([0, duration])
                            .range([0, 2 * Math.PI]);

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

    function time_skip() {
        return function(g, i) {
            var start_time = $(this).attr('start_time');

            console.log('Skip to time: ' + start_time);
            $('#audio-widget')[0].currentTime = start_time;

            d3.selectAll('path').style('stroke', 'none');
            var level = $(this).attr('level');
            var label = $(this).attr('label');
            var my_arcs = d3.selectAll('[level="' + level + '"][label="' + label + '"]');
            my_arcs.style('stroke', 'white')
                    .style('stroke-width', '4px')
                    .style('stroke-opacity', 1.0);

        };
    }

    for (var segment_level = 0; segment_level < all_segments.length; segment_level++) {
        var intervals = all_segments[segment_level][0];
        var labels    = all_segments[segment_level][1];

        // Iterate over segment hierarchy levels
        var arcs = svg.append('g');
        var segment_width = 35 - 2 * segment_level;

        for (var j = 0; j < intervals.length; j++) {
            // Iterate over segments within this level
            
            var segment_arc = d3.svg.arc()
                                .startAngle(time_to_rad(intervals[j][0]))
                                .endAngle(time_to_rad(intervals[j][1]))
                                .padRadius(0)
                                .innerRadius(radius_i)
                                .outerRadius(radius_i + segment_width);

            arcs.append('path')
                .attr('d', segment_arc)
                .style('fill', colors[labels[j]])
                .style('fill-opacity', 0.75)
                .attr('level', segment_level)
                .attr('start_time', intervals[j][0])
                .on('mouseenter', highlight(segment_level, true))
                .on('mouseleave', highlight(segment_level, false))
                .on('click', time_skip());
        }
        radius_i = radius_i + segment_width + 1;
    }
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

