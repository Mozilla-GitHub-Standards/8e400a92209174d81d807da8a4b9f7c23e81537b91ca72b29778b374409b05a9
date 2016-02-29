
var api = "/spark/api/v1";
var update_frequency = 10000; // ms


/* 
cache is an array of application objects with an added property jobs.
application.jobs is the result of the /applications/applicationId/jobs
API request.
*/
var cache = [];

var update = function() {
    update_cache(update_dialog_contents);
}

// callbacks follows jQuery callback style, can be either single function or array of functions
// callbacks will be passed the cache as a parameter
var update_cache = function(callbacks) {
    var cbs;
    if (callbacks) {
        cbs = $.Callbacks();
        cbs.add(callbacks);
    }
    $.getJSON(api + '/applications').done(function(applications) {
        applications.forEach(function(application, i) {
            $.getJSON(api + '/applications/' + application.id + '/jobs').done(function (jobs) {
                cache[i] = application;
                cache[i].jobs = jobs;
                if (cbs) {
                    // FIXME: need to check if all applications have been updated
                    cbs.fire(cache);
                }
            });
        });
    });
}

var update_dialog_contents = function() {
    if ($('#dialog_contents').length) {
        var element = $('<div/>').attr('id', 'dialog_contents');
        cache.forEach(function(application, i){
            element.append(create_application_table(application));
        })

        $('#dialog_contents').replaceWith(element);
    }
}

var create_application_table = function(e) {
    var application_div = $('<div/>');
    application_div.append($('<h5/>').text(e.name + ': ' + e.id));
    var application_table = $('<table/>').addClass('table table-hover');

    var header_row = $('<tr/>');
    header_row.append($('<th/>').text('Job ID'));
    header_row.append($('<th/>').text('Job Name'));
    header_row.append($('<th/>').text('Progress'));
    application_table.append(header_row);

    e.jobs.forEach(function(job, i) {
        application_table.append(create_table_row(job));
    });

    application_div.append(application_table);
    return application_div;
}

var create_table_row = function(e) {
    var row = $('<tr/>');
    row.append($('<td/>').text(e.jobId));
    row.append($('<td/>').text(e.name));
    
    var status_class;
    switch(e.status) {
        case 'SUCCEEDED':
            status_class = 'progress-bar-success';
            break;
        case 'RUNNING':
            status_class = 'progress-bar-info';
            break;
        case 'FAILED':
            status_class = 'progress-bar-danger';
            break;
        case 'UNKNOWN':
            status_class = 'progress-bar-warning';
            break;
    }
    
    // progress defined in percent
    var progress = e.numCompletedTasks / e.numTasks * 100;

    var progress_bar_div = $('<div/>').addClass('progress').css({'min-width': '100px', 'margin-bottom': 0});
    var progress_bar = $('<div/>')
        .addClass('progress-bar ' + status_class)
        .attr('role', 'progressbar')
        .attr('aria-valuenow', progress)
        .attr('aria-valuemin', 0)
        .attr('aria-valuemax', 100)
        .css({'width': progress + '%', 'min-width': '10px'})
        .text(e.numCompletedTasks + ' out of ' + e.numTasks + ' tasks');
    progress_bar_div.append(progress_bar);
    row.append($('<td/>').append(progress_bar_div));
    return row;
}


define(['jquery', 'base/js/dialog', 'base/js/events', 'notebook/js/codecell'], function ($, dialog, events, codecell) {

    var CodeCell = codecell.CodeCell;

    var show_running_jobs = function() {
        var element = $('<div/>').attr('id', 'dialog_contents');
        var modal = dialog.modal({
            title: "Running Spark Jobs",
            body: element,
            buttons: {
                "Close": {}
            },
            open: update_dialog_contents
        });
    };

    var spark_progress_bar = function(event, data) {
        // TODO: Update progress bar as Spark tasks are being completed
        // TODO: Remove progress bar when all tasks are completed
        var cell = data.cell;
        if (is_spark_cell(cell)) {
            add_progress_bar(cell);
        };
    };

    var create_progress_bar = function(status_class, completed, total) {
        // progress defined in percent
        var progress = completed / total * 100;
        console.log("Progress is " + progress);

        var progress_bar_div = $('<div/>').addClass('progress').css({'min-width': '100px', 'margin-bottom': 0});
        var progress_bar = $('<div/>')
            .addClass('progress-bar ' + status_class)
            .attr('role', 'progressbar')
            .attr('aria-valuenow', progress)
            .attr('aria-valuemin', 0)
            .attr('aria-valuemax', 100)
            .css('width', progress + '%')
            .text(completed + ' out of ' + total + ' tasks');
        progress_bar_div.append(progress_bar);
        return progress_bar_div;
    };

    var add_progress_bar = function(cell) {
        var progress_bar_div = cell.element.find('.progress-container');
        if (progress_bar_div.length < 1) {
            var input_area = cell.element.find('.input_area');
            var progress_bar_container = $('<div/>')
                .addClass('progress-container')
                .css({'border': 'none', 'border-top': '1px solid #CFCFCF'})
                // Temp check to see if progress bar will actually update/be removed
                .on('click', function (evt) {update_progress_bar(cell, 'progress-bar-info', Math.floor(Math.random()*5), 5)})
                .on('dblclick', function (evt) {remove_progress_bar(cell)});

            progress_bar = create_progress_bar('progress-bar-info', 1, 5);
            progress_bar.appendTo(progress_bar_container);
            progress_bar_container.appendTo(input_area);
        };
    };

    var update_progress_bar = function(cell, status_class, completed, total) {
        var progress_bar = cell.element.find('.progress');
        if (progress_bar.length < 1) {
            console.log("No progress bar found");
        };
        var progress = completed / total * 100;
        progress_bar.addClass('progress-bar ' + status_class)
                    .attr('aria-valuenow', progress)
                    .css('width', progress + '%')
                    .text(completed + ' out of ' + total + ' tasks');
    };

    var remove_progress_bar = function(cell) {
        var progress_bar_div = cell.element.find('.progress-container'); 
        if (progress_bar_div.length < 1) {
            console.log("No progress bar found");
        };
        progress_bar_div.remove();
    };

    var is_spark_cell = function(cell) {
        // TODO: Find a way to detect if cell is actually running Spark
        return (cell instanceof CodeCell)
    };

    var load_ipython_extension = function () {

        events.on('execute.CodeCell', spark_progress_bar);

        Jupyter.keyboard_manager.command_shortcuts.add_shortcut('Alt-S', show_running_jobs);
        Jupyter.toolbar.add_buttons_group([{    
            'label':    'show running Spark jobs',
            'icon':     'fa-tasks',
            'callback': show_running_jobs,
            'id':       'show_running_jobs'
        }]);
        update();
        window.setInterval(update, update_frequency);
    };

    return {
        load_ipython_extension: load_ipython_extension
    };
});