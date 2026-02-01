
// Global site coordinates

var MARKER_RADIUS_PX = 12;

var currentLat = null,
    currentLon = null;

var progressbar = {

    // Reset to initial idle state

    init: function () {

        jQuery("#offcanvas")
            .find(".progress-bar")
            .css("width", "0%")
            .attr("aria-valuenow", 0)
            .removeClass("progress-bar-striped progress-bar-animated");

    },

    // Show running / busy state

    busy: function () {

        jQuery("#offcanvas")
            .find(".progress-bar")
            .css("width", "100%")
            .attr("aria-valuenow", 100)
            .addClass("progress-bar-striped progress-bar-animated");

    }

};

var msgbox = {

    hide: function () {

        jQuery("#msgbox").modal("hide");

    },

    show: function (html) {

        if (typeof html === "undefined") {
            html = "";
        }

        jQuery("#msgbox").modal("show");
        jQuery("#msgbox").find(".msgboxContent").html(html);

    },

    show_html: function (ic, tx) {

        var html = "";

        html += "<div class='text-center'>";
        html += "<i class='bi " + ic + "'></i> ";
        html += "&nbsp; ";
        html += tx;
        html += "</div>";

        this.show(html);

    },

    success: function (tx) {

        this.show_html("bi-check2-circle", tx);

    },

    failure: function (tx) {

        this.show_html("bi-x-circle", tx);

    },

    info: function (tx) {

        this.show_html("bi-info-circle", tx);

    }

};

var areaChart = {

    chart: null,
    options: null,

    init: function () {

        google.charts.setOnLoadCallback(() => {

            this.chart = new google.visualization.AreaChart(
                document.getElementById("chart-container")
            );

            this.options = {

                isStacked: true,
                areaOpacity: 0.85,
                curveType: "function",   // smooth areas slightly

                legend: {
                    position: "top",
                    alignment: "center"
                },

                hAxis: {
                    title: "Hour",
                    format: "0",
                    gridlines: { count: 24 },   // integer hour ticks
                    minorGridlines: { count: 0 }
                },

                vAxis: {
                    title: "Power",
                    baseline: 0,
                    gridlines: { color: "#e0e0e0" }
                },

                chartArea: {
                    left: 70,
                    right: 20,
                    top: 50,
                    bottom: 60,
                    width: "100%",
                    height: "100%"
                },

                // Tableau-style palette

                colors: [
                    "#E15759", // BESS
                    "#4E79A7", // Wind
                    "#F2BE4A"  // Solar
                ]
            };

        });

    },

    plot: function (uc) {

        // uc = unit_commitment object from backend

        if (!this.chart || !uc) return;

        var table = [
            ["Hour", "BESS", "Wind", "Solar"]
        ];

        var n = uc.hour.length;

        for (var i = 0; i < n; i++) {
            table.push([
                uc.hour[i],          // integer hour
                uc.bess[i] || 0,     // BESS (+ / -)
                uc.wind[i] || 0,     // Wind
                uc.solr[i] || 0      // Solar
            ]);
        }

        var dataTable =
            google.visualization.arrayToDataTable(table);

        this.chart.draw(dataTable, this.options);

    }

};

google.charts.setOnLoadCallback(function () {

    areaChart.init();

    jQuery(document).ready(function () {

        // Map container and size

        var container = d3.select("#map-container"),
            width = window.innerWidth,
            height = window.innerHeight;

        // Create SVG

        var svg = container.append("svg")

            .attr("width", width)

            .attr("height", height)

            .attr("viewBox", [0, 0, width, height]);

        // Group for zoomable content

        var g = svg.append("g");

        // Map projection

        var projection = d3.geoMercator()

            .scale(width / 2 / Math.PI)

            .translate([width / 2, height / 1.5]);

        // Geo path generator

        var path = d3.geoPath().projection(projection);

        // Zoom behaviour

        var zoom = d3.zoom()

            .scaleExtent([1, 8])

            .on("zoom", function (event) {

                g.attr("transform", event.transform);

                g.selectAll(".marker").attr("r", MARKER_RADIUS_PX / event.transform.k);

                g.selectAll(".country").attr("stroke-width", 0.5 / event.transform.k);

            });

        svg.call(zoom);

        // Load and draw world map

        d3.json("3p/topojson-client/3.1.0/countries-50m.json")

            .then(function (world) {

                var countries = topojson.feature(world, world.objects.countries);

                g.selectAll("path")

                    .data(countries.features)

                    .enter()

                    .append("path")

                    .attr("class", "country")

                    .attr("d", path)

                    .attr("id", function (d) {

                        return "country-" + d.id;

                    });


            })

            .catch(function (err) {

                console.error("Error loading map data:", err);

            });

        // Click map to place marker and open form

        svg.on("click", function (event) {

            // Ignore marker clicks

            if (event.target.classList.contains("marker")) return;

            var transform = d3.zoomTransform(svg.node()),
                point = d3.pointer(event, svg.node());

            // Undo zoom transform

            var rawX = (point[0] - transform.x) / transform.k,
                rawY = (point[1] - transform.y) / transform.k;

            // Convert to lon/lat

            var coords = projection.invert([rawX, rawY]);

            if (!coords) return;

            var lon = coords[0],
                lat = coords[1];

            placeMarker(rawX, rawY, transform.k);

            // Delay for visual feedback

            setTimeout(function () {
                showOffcanvas(lat, lon);
            }, 1000);

        });

        // Draw marker at selected location

        function placeMarker(x, y, scale) {

            g.selectAll(".marker").remove();

            g.append("circle")

                .attr("cx", x)

                .attr("cy", y)

                .attr("r", MARKER_RADIUS_PX / scale)

                .attr("class", "marker");

        }

        // Offcanvas instance

        var canvas = new bootstrap.Offcanvas("#offcanvas");

        // Show offcanvas and store coordinates

        function showOffcanvas(lat, lon) {

            currentLat = lat;
            currentLon = lon;

            // Reset form and UI state

            jQuery("#offcanvas_form")[0].reset();

            jQuery("#offcanvas")

                .find(".is-invalid, .is-valid")

                .removeClass("is-invalid is-valid")

                .removeAttr("aria-invalid");

            progressbar.init();

            jQuery("#offcanvas").find(".result").empty();

            jQuery("#offcanvas").find(".get_data_btn").attr("data-csv", "");

            // Update title

            jQuery("#offcanvas .offcanvas-title").html(

                "<i class='bi bi-geo-alt'></i> &nbsp; " + lat.toFixed(3) + " , " + lon.toFixed(3)

            );

            restoreApiKey("ninj");

            restoreApiKey("ieso");

            jQuery("#offcanvas").find(".get_data_btn").prop("disabled", true);

            jQuery("#offcanvas").find(".scrollable").scrollTop(0);

            canvas.show();

        }

        // Remove marker when panel closes

        jQuery("#offcanvas").on("hidden.bs.offcanvas", function () {

            setTimeout(function () {
                g.selectAll(".marker").remove();
            }, 1000);

        });

        // Resize SVG on window resize

        window.addEventListener("resize", function () {

            container.select("svg")

                .attr("width", window.innerWidth)

                .attr("height", window.innerHeight);

        });

        // Save API key to localStorage

        function saveApiKey(id) {

            var v = jQuery("#" + id).val().trim();

            if (v !== "") {

                localStorage.setItem(id, v);

            }

        }

        // Restore API key from localStorage

        function restoreApiKey(id) {

            var v = localStorage.getItem(id);

            if (v !== null) {

                jQuery("#" + id).val(v);

            }

        }

        // Validate form inputs

        window.valid_form = function () {

            var isValid = true;

            jQuery("#offcanvas_form input[data-expected]").each(function () {

                var $input = jQuery(this),
                    raw = $input.val().trim(),
                    type = $input.data("expected"),
                    fieldValid = true;

                $input.removeClass("is-invalid is-valid");

                if (type === "text") {

                    if (raw === "") fieldValid = false;

                } else {

                    var value = Number(raw),
                        min = $input.data("mini"),
                        max = $input.data("maxi");

                    if (raw === "" || Number.isNaN(value)) {

                        fieldValid = false

                    };

                    if (fieldValid && type === "integer" && !Number.isInteger(value)) {

                        fieldValid = false

                    };

                    if (fieldValid && Number.isFinite(min) && value < min) {

                        fieldValid = false

                    };

                    if (fieldValid && Number.isFinite(max) && value > max) {

                        fieldValid = false

                    };

                }

                if (!fieldValid) {

                    $input.addClass("is-invalid");

                    isValid = false;

                } else {

                    $input.addClass("is-valid");

                }

            });

            return isValid;

        };

        // Clear validation state on input

        jQuery("#offcanvas_form").on("input", "input", function () {

            jQuery(this).removeClass("is-invalid is-valid");

        });

        // Helpers for values

        function num(id) {

            return Number(jQuery("#" + id).val());

        }

        function bool(id) {

            return jQuery("#" + id).is(":checked") ? 1 : 0;

        }

        function txt(id) {

            return jQuery("#" + id).val().trim();

        }

        function fmt(v, d) {

            return (typeof v === "number") ? v.toFixed(d) : "";

        }

        // Run simulation

        function data_toCSV(data) {

            if (!data) return "";

            var rows = [];

            // Header

            rows.push("Metric,Value");

            // Ordered mapping: key → label

            var map = [
                ["inst_solr", "Installed Solar PV (MW)"],
                ["firm_solr", "Firming Solar PV (MW)"],
                ["inst_wind", "Installed Wind (MW)"],
                ["firm_wind", "Firming Wind (MW)"],
                ["firm_disp", "Firming Dispatchable (MW)"],
                ["inst_bess", "Installed BESS (MWh)"],
                ["firm_bess", "Firming BESS (MWh)"],
                ["generation", "Annual Generation (MWh)"],
                ["cost", "Firm LCOE (USD/MWh)"],
                ["cost_lcoe", "LCOE (USD/MWh)"],
                ["cost_firm", "Firming Markup (USD/MWh)"],
                ["cost_firm_solr", "Firming Cost - Solar PV (USD/MWh)"],
                ["cost_firm_wind", "Firming Cost - Wind (USD/MWh)"],
                ["cost_firm_bess", "Firming Cost - BESS (USD/MWh)"],
                ["reliability", "Reliability"]
            ];

            for (var i = 0; i < map.length; i++) {

                var key = map[i][0];
                var label = map[i][1];

                if (typeof data[key] !== "undefined") {

                    var value = data[key];

                    rows.push(label + "," + fmt(value, 4));

                }

            }

            return rows.join("\n");

        }

        function data_toUI(data) {

            if (!data) return;

            // Numeric fields

            jQuery(".result.firm_solr").html(fmt(data.firm_solr, 2));
            jQuery(".result.firm_wind").html(fmt(data.firm_wind, 2));
            jQuery(".result.firm_bess").html(fmt(data.firm_bess, 2));

            jQuery(".result.cost").html(fmt(data.cost, 2));
            jQuery(".result.cost_lcoe").html(fmt(data.cost_lcoe, 2));
            jQuery(".result.cost_firm").html(fmt(data.cost_firm, 2));

            jQuery(".result.cost_firm_solr").html(fmt(data.cost_firm_solr, 2));
            jQuery(".result.cost_firm_wind").html(fmt(data.cost_firm_wind, 2));
            jQuery(".result.cost_firm_bess").html(fmt(data.cost_firm_bess, 2));

            // Button

            jQuery("#summary_tabl").attr("data-csv", data_toCSV(data));

            // Enable all buttons

            jQuery("#offcanvas").find(".get_data_btn").prop("disabled", false);

            // Update area chart

            areaChart.plot(data.unit_commitment);

        }

        jQuery("#simulate").on("click", function () {

            if (!valid_form()) {

                var $err = jQuery(".is-invalid").first();

                if ($err.length) {

                    $err[0].scrollIntoView({ behavior: "smooth", block: "center" });

                }

                return;

            }

            saveApiKey("ninj");

            saveApiKey("ieso");

            var payload = {
                apik: {
                    ieso: txt("ieso"),
                    ninj: txt("ninj")
                },
                site: {
                    lolat: currentLat,
                    lolon: currentLon,
                    cDura: num("cDura"),
                    oDura: num("oDura"),
                    kCost: num("kCost"),
                    rTarg: num("rTarg")
                },
                solr: {
                    iCapa: num("iCapa_solr"),
                    cCost: num("cCost_solr"),
                    oCost_t_cCost: num("oCost_t_cCost_solr"),
                    fOpts: bool("fOpts_solr")
                },
                wind: {
                    iCapa: num("iCapa_wind"),
                    cCost: num("cCost_wind"),
                    oCost_t_cCost: num("oCost_t_cCost_wind"),
                    fOpts: bool("fOpts_wind")
                },
                bess: {
                    iCapa: num("iCapa_bess"),
                    hStrg: num("hStrg_bess"),
                    rtEff: num("rtEff_bess"),
                    shBOS: num("shBOS_bess"),
                    cCost: num("cCost_bess"),
                    oCost_t_cCost: num("oCost_t_cCost_bess"),
                    fOpts: bool("fOpts_bess")
                }
            };

            progressbar.busy();

            jQuery.ajax({

                url: "https://greoux.re/a/rtc/",

                method: "POST",

                data: JSON.stringify(payload),

                contentType: "application/json",

                dataType: "json",

                timeout: 900000,

                // Handle application-level response

                success: function (response) {

                    // Validate response shape

                    if (!response || typeof response.rs === "undefined") {

                        msgbox.failure("Invalid server response");
                        return;

                    }

                    // Success path

                    if (response.rs === 1) {

                        /* response.data:
    
                        {
                            "inst_solr": ...,
                            "firm_solr": ...,
                            "inst_wind": ...,
                            "firm_wind": ...,
                            "firm_disp": ...,
                            "inst_bess": ...,
                            "firm_bess": ...,
                            "generation": ...,
                            "cost": ...,
                            "cost_lcoe": ...,
                            "cost_firm": ...,
                            "cost_firm_solr": ...,
                            "cost_firm_wind": ...,
                            "cost_firm_bess": ...,
                            "reliability": ...,
                            "unit_commitment": {
                                "hour": [1, 2, 3, ...],
                                "bess": [-1, +2, -3, ...],
                                "wind": [1, 2, 3, ...],
                                "solr": [1, 2, 3, ...],
                            }
                        }
    
                        */

                        data_toUI(response.data);

                        msgbox.success("Simulation completed successfully");

                        console.log(response.tx);

                    }

                    // Failure path (application error)

                    else {

                        msgbox.failure("Simulation failed");

                        console.log(response.tx);

                    }

                },

                // Handle transport / network errors

                error: function (xhr, status, error) {

                    var tx = error || status || "Network error";

                    msgbox.failure("Request failed: " + tx);

                },

                complete: function () {

                    progressbar.init();

                }

            });

        });

        jQuery(".get_data_btn").on("click", function () {

            var csv = jQuery(this).attr("data-csv");

            if (!csv) {
                return;
            }

            var blob = new Blob([csv], {
                type: "text/csv;charset=utf-8"
            });

            saveAs(blob, "data.csv");

        });

    });

});
