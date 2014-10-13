// nothing here yet

$(document).ready(function() {
//     search_graph($('#seed_id').val(), $('#depth').val());
    // Query for the collections list
    $.ajax({ url: '/collections', dataType: 'json'}).done(update_collections);

    // Set the default and update the pager
    var collection_id   = parseInt($('#collection_id').val());
    get_collection(collection_id, 0, 18);

    $('#track-min').change(function(eventObject) {
        var offset = parseInt($(this).val());

        if (offset < 1 || offset >=
            parseInt($('#track_count').val())) {

            $('#track-form').addClass('has-error');
            return;
        }
        $('#track-form').removeClass('has-error');

        var collection_id   = parseInt($('#collection_id').val());

        get_collection(collection_id, offset-1, 18);
    });
});

function dv(x, v) {

    if ((typeof x) !== undefined) {
        return x;
    }
    return v;
}

function update_collections(collections) {
    // Clear the collections list
    $("#collections-count").text(collections.length);

    $("#collections-menu > *").remove();

    // Populate the collections list
    var menu = $("#collections-menu");

    for (var c in collections) {
        var li = $('<li role="presentation">');
    
        var button = $('<button type="button">')
                            .addClass('btn')
                            .addClass('btn-link')
                            .addClass('btn-block');

        button.text(collections[c].name);
        var hidden = $('<input type="hidden">');
        hidden.val(collections[c].collection_id);

        button.append(hidden);

        button.click(function() {
            var hidden = $(this).find('input:hidden')[0];

            get_collection($(hidden).val(), 0, 18);
        });
        
        var badge = $('<span>').addClass('badge').addClass('pull-right');

        badge.text(collections[c].track_count);

        button.append(badge);
        li.append(button);
        menu.append(li);
    }

}


$('.previous').click(function() {
    if ($(this).hasClass('disabled')) {
        return;
    }
    var offset          = parseInt($('#offset').val());
    var limit           = parseInt($('#limit').val());
    var collection_id   = parseInt($('#collection_id').val());

    get_collection(collection_id, Math.max(offset - limit, 0), limit);
});

$('.next').click(function() {
    if ($(this).hasClass('disabled')) {
        return;
    }
    var track_count     = parseInt($('#track_count').val());
    var offset          = parseInt($('#offset').val());
    var limit           = parseInt($('#limit').val());
    var collection_id   = parseInt($('#collection_id').val());

    get_collection(collection_id, Math.min(offset + limit, track_count-1), limit);
});

function get_collection(collection_id, offset, limit) {


    offset = dv(offset, 0);
    limit  = dv(limit, 18);

    offset = parseInt(offset);
    limit  = parseInt(limit);
    collection_id = parseInt(collection_id);

    // First update the collection container
    $.ajax({url: '/tracks/' + collection_id + '/' + offset + '/' + limit,
            dataType: 'json'}).done(function(tracklist) {
            $("#tracklist > *").remove();
            if (offset == 0) {
                $('.previous').addClass('disabled');
            } else {
                $('.previous').removeClass('disabled');
            }
            $('#offset').val(offset);
            $('#limit').val(limit);
            $('#collection_id').val(collection_id);

            var track_container = $("#tracklist");

            var start = 1 + offset;
            var end   = offset + tracklist.length;
            $("#track-min").val(start);
            $("#track-max").text(end);

            for (var i in tracklist) {
                
                var content = $('<a>')
                        .addClass('list-group-item')
                        .addClass('col-md-3')
                        .addClass('track')
                        .attr('href', '/track/'+ tracklist[i].track_id)
                        .attr('target', '_blank');


                content.append($('<h4>')
                        .addClass('list-group-item-heading')
                        .text(tracklist[i].title));

                var ctext = tracklist[i].artist;
//                 if (tracklist[i].album.length > 0) {
//                     ctext += ' - ' + tracklist[i].album;
//                 }

                content.append($('<p>')
                        .addClass('list-group-item-text')
                        .addClass('text-muted')
                        .text(ctext));
                
                track_container.append(content);
            }
            // Update the collection container object
            $.ajax({url: '/collection/' + collection_id, dataType: 'json'}).done(
                function(data) {
                    $("#track-total").text(data.track_count);
                    $("#collection-name").text(data.name);
                    $('#track_count').val(data.track_count);

                    if (data.track_count > offset + tracklist.length) {
                        $('.next').removeClass('disabled');
                    } else {
                        $('.next').addClass('disabled');
                    }
                }
            );
    });

}
