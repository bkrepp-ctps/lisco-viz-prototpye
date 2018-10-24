$(document).ready(function() {
    initialize();
    // The following folderol is necessary because of the way the jQueryUI accordion control works...
    $('#i93_sb_accordion').show();
    var activePanel = $('#i93_nb_accordion').accordion('option', 'active');
    prepDataAndGenerateViz('i93_sb', activePanel);
});	

// Data structure encapsulating the state of all accordion panels
// If chartApi == null, "panel" has not been initialized
var panelsState = {
    'i93_nb' :  {   'panels' :  [   { name: 'xx', panelIx : 0, chartApi : null },
                                    { name: 'xx', panelIx : 1, chartApi : null },
                                    { name: 'xx', panelIx : 2, chartApi : null },
                                    { name: 'xx', panelIx : 3, chartApi : null },
                                    { name: 'xx', panelIx : 4, chartApi : null },
                                    { name: 'xx', panelIx : 5, chartApi : null }  
                                ]
                },   
    'i93_sb' :  {   'panels' :  [   { name: 'i93_sb_wilmington',            panelIx:  0, chartApi : null },
                                    { name: 'i93_sb_woburn_to_stoneham',    panelIx : 1, chartApi : null },
                                    { name: 'i93_sb_medford_to_somerville', panelIx : 2, chartApi : null },
                                    { name: 'i93_sb_storrow_to_kneeland',   panelIx : 3, chartApi : null },
                                    { name: 'i93_sb_kneeland_to_columbia',  panelIx : 4, chartApi : null },
                                    { name: 'i93_sb_freeport_to_braintree', panelIx : 5, chartApi : null }   
                                ]
                },

    'sr3_nb' :  {   'panels' : [    { name: 'sr3_nb', panelIx : 0, chartApi : null }
                               ]                
                },
    'sr3_sb' :  {   'panels' : [    { name: 'sr3_sb', panelIx : 0, chartApi: null }
                               ]
                }
};

var volumePaletteColor = d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, 150000])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]);
                    
var volumePaletteWidth = d3.scaleThreshold()
                     .domain([0, 25000, 50000, 75000, 100000, 150000])
                     .range(["1px", "2px", "3px", "4px", "5px", "6px"]);   
                     
var colorPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, 150000])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, 10000])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"])
};
var widthPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, 150000])
                    .range(["1px", "2px", "3px", "4px", "5px", "6px"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, 10000])
                    .range(["1px", "2px", "3px", "4px", "5px", "6px"])
};

function initialize() {
    $('.accordion').accordion({ heightStyle: 'content' });
    $('.accordion').hide();
    $('#select_route').selectmenu();
    
    // on-change event handler for select_route <select> control
    $('#select_route').on( "selectmenuchange", 
        function(event, ui) {
            $('.accordion').hide();
            var selected_route_id = ui.item.value;
            var accordion_id = selected_route_id + '_accordion';
            $('#' + accordion_id).show();
            // Determine which accordion is active, i.e., which route we're dealing with, and
            // which accordion panel is being activated, i.e., wihch route segment we're dealing with.
            // If viz not yet generated, generate it.
            var activePanel = $('#' + accordion_id).accordion('option', 'active');
            if (panelsState[selected_route_id].panels[activePanel].chartApi == null) {
                prepDataAndGenerateViz(selected_route_id, activePanel);
            }            
        });

    // on-activate event handler for accordion panels
    $( ".accordion" ).on('accordionactivate', 
        function(event, ui) {
            // Determine which accordion is active, i.e., which route we're dealing with, and
            // which accordion panel is being activated, i.e., wihch route segment we're dealing with.
            // If viz not yet generated, generate it.
            var routeStr = event.target.id.replace('_accordion', '');
            var panelNum = +ui.newPanel[0].id.replace(routeStr + '_viz_','');
            if (panelsState[routeStr].panels[panelNum].chartApi == null) {
                prepDataAndGenerateViz(routeStr, panelNum);
            }
        });
    
    // on-change event handler for select_metric <select> controls
    $('.select_metric').on('change', function(event) {
        // 'this' is the HTML <select> element that triggered the event
        var metric = this.selectedOptions[0].getAttribute('metric');
        var routeStr = this.parentElement.parentElement.id.replace('_accordion','');
        var panelNum = +this.parentElement.id.replace(routeStr + '_viz_', '');
        // console.log('route : ' + routeStr + ' panel : ' + panelNum + ' metric : ' + metric);
        symbolizeViz(routeStr, panelNum, metric);
    });
} // initialize()

// prepDataAndGenerateViz - function
//
function prepDataAndGenerateViz(routeName, panelIx) {
    var chartApi = {};
    var csvName = 'data/' + panelsState[routeName].panels[panelIx].name + '.csv';
    var volumesName = 'data/' + panelsState[routeName].panels[panelIx].name +  '_VOLUMES.csv';
    var q = d3.queue()
            .defer(d3.csv, csvName)
            .defer(d3.csv, volumesName)
            .awaitAll(function(error, results) {
                 if (error !== null) {
                    alert('Failure loading CSV file(s).\n' +
                          'Status: ' + error.status + '\n' +
                          'Status text: ' + error.statusText + '\n' +
                          'URL :' + error.responseURL);
                    return;
                } 
                var lineData = results[0];  
                var volumeData = results[1];
                // "Join" volume data to "line" (i.e., geometry) data
                lineData.forEach(function(item) {
                    var searchResults = _.where(volumeData, { unique_id : item.unique_id });
                    if (searchResults.length !== 1) {
                        console.log("Failure in join with key = " + item.unique_id);
                        alert("Failure in join with key = " + item.unique_id);
                        return;
                    } else {
                        item.volumes = searchResults[0];
                    }
                });
                // Make numeric data in CSVs usable: convert string to number where necessary
                lineData.forEach(function(i) {
                    i.x1 = +i.x1;
                    i.y1 = +i.y1;
                    i.x2 = +i.x2;
                    i.y2 = +i.y2;
                    i.volumes.awdt_2010 = +i.volumes.awdt_2010;
                    i.volumes.peak_2010_6_to_7_am  = +i.volumes.peak_2010_6_to_7_am;
                    i.volumes.peak_2010_7_to_8_am  = +i.volumes.peak_2010_7_to_8_am;
                    i.volumes.peak_2010_8_to_9_am  = +i.volumes.peak_2010_8_to_9_am;
                    i.volumes.peak_2010_9_to_10_am = +i.volumes.peak_2010_9_to_10_am; 
                    i.volumes.peak_2010_3_to_4_pm  = +i.volumes.peak_2010_3_to_4_pm;
                    i.volumes.peak_2010_4_to_5_pm  = +i.volumes.peak_2010_4_to_5_pm;
                    i.volumes.peak_2010_5_to_6_pm  = +i.volumes.peak_2010_5_to_6_pm;
                    i.volumes.peak_2010_6_to_7_pm  = +i.volumes.peak_2010_6_to_7_pm;
                });
                chartApi = generateViz(routeName, panelIx, lineData);
                panelsState[routeName].panels[panelIx].chartApi = chartApi;
                // When first created, default synbolization is by 2010 AWDT
                symbolizeViz(routeName, panelIx, 'awdt_2010');
            });
} // prepDataAndGenerateViz()

// generateViz - function
//
// Given:
//       (1) a route name string, 
//       (2) a panel index number, and 
//       (3) CSV data definline the SVG linework for the route
//           setment and the associated balanced volume data,
// does the following:
//       (1) generates the SVG <line> elements for a "wireframe" chart and
//           SVG <text> elements for the associated data labels
//       (2) creates an object representing the API to these selected SVG elements
//           bound to the corresponding volume data, and stores this in the 
//          'chartApi' property of the relevant object in 'panelsState'  
function generateViz(routeName, panelIx, lineData) {
    // Define SVG container ('viewport')
    var height = 300; // Hardwired for now
    /* var width = 3550;  */
    var width = d3.max([d3.max(lineData, function(d) { return d.x1; }),
                        d3.max(lineData, function(d) { return d.x2; })]);

    var divName = routeName + '_viz_' + panelIx;
		
	var svgContainer = d3.select('#' + divName).append("svg")
		.attr("width", width)
		.attr("height", height)
		.style("border", "2px solid steelblue");

    var svgRouteSegs = svgContainer
		.selectAll("line")
		.data(lineData)
		.enter()
		.append("line")
            .attr("id", function(d, i) { return d.unique_id; })
            .attr("x1", function(d, i) { return d.x1; })
            .attr("y1", function(d, i) { return d.y1; })
            .attr("x2", function(d, i) { return d.x2; })
            .attr("y2", function(d, i) { return d.y2; })
            .attr("class", function(d, i) { return d.type; });
    
    var svgText = svgContainer.selectAll("text")
        .data(lineData)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'txt_' +d.unique_id; })
            .attr("class", function(d, i) { return 'txt_' + d.type; })
            .attr("x", function(d, i) { return d.x1 + ((d.x2 - d.x1)/2); })
            .attr("y", function(d, i) { return d.y1 + ((d.y2 - d.y1)/2) - 5; })
            .attr("text-anchor", "middle")
            .text('');
            
    var chartApi = {
        lines : svgRouteSegs,
        txt   : svgText
    };      
    return chartApi;
} // generateViz()

// synbolizeViz - function
// Symbolize the chart in the panelNum-th panel of the accordion display for "routeStr",
// according to the selected metric
function symbolizeViz(routeStr, panelNum, metric) {
    var chartApi = panelsState[routeStr].panels[panelNum].chartApi;
    var colorPalette = metric.search('awdt') !== -1 ? colorPalettes.awdt : colorPalettes.hourly;
    var widthPalette = metric.search('awdt') !== -1 ? widthPalettes.awdt : widthPalettes.hourly;
    chartApi.lines
        .style("stroke", function(d, i) { return colorPalette(d.volumes[metric]); }) 
        .style("stroke-width", function(d, i) { return widthPalette(d.volumes[metric]); });
    chartApi.txt
        .text(function(d, i) { return d.volumes[metric].toLocaleString(); });    
} // symbolizeViz()
