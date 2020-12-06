let et = require('elementtree');
let format = require('xml-formatter');
const nd = require('nd4js');
let nodes = new vis.DataSet([]); // set of nodes of the Bayesian network vis.js object
let edges = new vis.DataSet([]); // set of edges of the Bayesian network vis.js object
let container = document.getElementById('graph');
let network = new vis.Network(container, {nodes: nodes, edges: edges}, {}); // vis.js network
let fg_network // factor graph network
let fg_nodes = new vis.DataSet([]); // set of nodes of the factor graph vis.js object
let fg_edges = new vis.DataSet([]); // set of edges of the factor graph vis.js object
var factor_graph; // Factor Graph
let already_selected_node // variable used to draw edges: it contains the source node

/* global variables for keeping the state among successive inference steps */
let round=0 // belief propagation round
let cur_marginals; // current marginals
let last_marginals; // previous marginals
let all_fg_nodes = {} // array of nodes of factor_graph
let sender_nodes // list of nodes scheduled to send a message
let next_sender // next node scheduled to send a message
let next_dests  // next nodes scheduled to receive a message

/* variables for saving the message associated to an edge before applying the bold style
to highlight the message */
let old_edge_label 
let old_edge_id

let epsilon // the sum of the absolute difference of the components of two marginals



activate_interactions()

function delete_node(node_id) 
/* remove a node from the vis.js graph */
{
    let to_edges = get_to_edges_from_node(node_id);
    let from_edges = get_from_edges_to_node(node_id);
    for (const e in to_edges) {
        delete_edge(to_edges[e]);
    }
    for (const e in from_edges) {
        delete_edge(from_edges[e]);
    }
    nodes.remove(node_id);
}

function delete_edge(edge_id) 
/* remove an edge from the vis.js graph */
{
    let edge = edges.get(edge_id);
    let node_id = edge.from;
    let to_id = edge.to;
    let to_node = nodes.get(to_id);
    if (to_node !== null) {
        let index = to_node.probability.given.indexOf(node_id.toString());
        to_node.probability.given.splice(index, 1);
        update_probabilities(to_id);
    }
    edges.remove(edge_id);
}

function update_probabilities(node_id) 
/* updates the probability of a node in the vis.js graph */
{
    let node = nodes.get(node_id);
    let new_table = [];
    let index_arrays = generate_index_arrays(node_id);
    for (const i_array in index_arrays) {
        new_table.push(1 / node.domain.length);
    }
    node.probability.table = new_table;
}

function get_probability_cursor(node_id, index_array) {
    /*
    This function takes the Node ID and an index array, for example [0, 0, 1] means that I want the
    cursor of the probability in which the first given is True, the second given is True and the Node, whose ID is specified,
    is False (if all of the three nodes have domains (True, False).
     */
    let node = nodes.get(node_id);
    let given = node.probability.given;
    let cursor = 0;
    for (const i in index_array) {
        let index = parseInt(index_array[i]);
        if (i == index_array.length - 1) {
            cursor += index;
        } else {
            let g_id = given[i];
            let g2_id;
            let g2_node;
            let combs_g_fwd = 1;
            for (const g2 in given) {
                g2_id = given[g2];
                g2_node = nodes.get(g2_id);
                if (g2_id > g_id) {
                    combs_g_fwd *= g2_node.domain.length;
                }
            }
            combs_g_fwd *= node.domain.length;
            cursor += index * combs_g_fwd;
        }
    }
    return cursor;
}

function get_probability(node_id, index_array) {
    /*
    After getting the cursor, get the probability by moving to the offset in the linear array which contains the
    probabilities.
     */
    let cursor = get_probability_cursor(node_id, index_array);
    let node = nodes.get(node_id);
    return node.probability.table[cursor];
}

function set_probability(node_id, index_array, value) {
    /*
    After getting the cursor, get the probability by moving to the offset in the linear array which contains the
    probabilities.
     */
    let cursor = get_probability_cursor(node_id, index_array);
    let node = nodes.get(node_id);
    node.probability.table[cursor] = value;
    return true;
}

function generate_index_arrays(node_id) {
    /*
    This function generates all the index arrays for the specified Node. The way it works is by first considering the
    domains of all the Given Nodes (the source nodes) and then generating, in the correct logical order, all the
    possible combinations of indexes.
    This functions works through iteration and not recursion.

    Example:

    Domains:
    Node 1: (T, F)
    Node 2: (T, F)
    Node 3: (A, B, C)

    Output:
    [0, 0, 0]
    [0, 0, 1]
    [0, 0, 2]
    [0, 1, 0]
    [0, 1, 1]
    [0, 1, 2]
    [1, 0, 0]
    [1, 0, 1]
    ...
     */
    let node = nodes.get(node_id);
    let given = node.probability.given;
    let g_id;
    let g_node;
    let index_arrays = [];
    let combs = 1;
    for (const g in given) {
        g_id = given[g];
        g_node = nodes.get(g_id);
        combs *= g_node.domain.length;
    }
    combs *= node.domain.length;
    for (let i = 0; i < combs; i++) {
        index_arrays.push([]);
    }
    for (const g in given) {
        g_id = given[g];
        g_node = nodes.get(g_id);
        let g2_id;
        let g2_node;
        let combs_g_fwd = 1;
        let combs_g_bwd = 1;
        for (const g2 in given) {
            g2_id = given[g2];
            g2_node = nodes.get(g2_id);
            if (g2 > g) {
                combs_g_fwd *= g2_node.domain.length;
            }
            if (g2 < g) {
                combs_g_bwd *= g2_node.domain.length;
            }
        }
        combs_g_fwd *= node.domain.length;
        for (let times = 0; times < combs_g_bwd; times++) {
            for (const d in g_node.domain) {
                for (let i = 0; i < combs_g_fwd; i++) {
                    index_arrays[times * combs_g_fwd * g_node.domain.length + parseInt(d) * combs_g_fwd + i].push(parseInt(d));
                }
            }
        }
    }

    let tot_times = combs / node.domain.length;
    for (let times = 0; times < tot_times; times++) {
        for (const d in node.domain) {
            index_arrays[times * node.domain.length + parseInt(d)].push(parseInt(d));
        }
    }
    return index_arrays;
}


function generate_index_arrays_factor(node_id) {
    /*
    This function generates all the index arrays for the specified Node. The way it works is by first considering the
    domains of all the Given Nodes (the source nodes) and then generating, in the correct logical order, all the
    possible combinations of indexes.
    This functions works through iteration and not recursion.

    Example:

    Domains:
    Node 1: (T, F)
    Node 2: (T, F)
    Node 3: (A, B, C)

    Output:
    [0, 0, 0]
    [0, 0, 1]
    [0, 0, 2]
    [0, 1, 0]
    [0, 1, 1]
    [0, 1, 2]
    [1, 0, 0]
    [1, 0, 1]
    ...
     */
    let node = fg_nodes.get(node_id);
    let factor=all_fg_nodes[node_id]
    let given = factor.connections
    let g_id;
    let g_node;
    let index_arrays = [];
    let combs = 1;
    for (const g in given) {
        g_id = given[g];
        g_node = fg_nodes.get(g_id.name);
        combs *= g_node.domain.length;
    }
    for (let i = 0; i < combs; i++) {
        index_arrays.push([]);
    }
    for (const g in given) {
        g_id = given[g];
        g_node = fg_nodes.get(g_id.name);
        let g2_id;
        let g2_node;
        let combs_g_fwd = 1;
        let combs_g_bwd = 1;
        for (const g2 in given) {
            g2_id = given[g2];
            g2_node = fg_nodes.get(g2_id.name);
            if (g2 > g) {
                combs_g_fwd *= g2_node.domain.length;
            }
            if (g2 < g) {
                combs_g_bwd *= g2_node.domain.length;
            }
        }
        for (let times = 0; times < combs_g_bwd; times++) {
            for (const d in g_node.domain) {
                for (let i = 0; i < combs_g_fwd; i++) {
                    index_arrays[times * combs_g_fwd * g_node.domain.length + parseInt(d) * combs_g_fwd + i].push(parseInt(d));
                }
            }
        }
    }

    return index_arrays;
}

function get_nodes_indip()
{
    /*
    By checking how many given (source) nodes each node has, we can know which nodes are indipendent.
     */
    let indip = [];
    for (const e in nodes._data) {
        if (nodes._data[e].probability.given.length == 0)
            indip.push(e);
    }
    return indip;
}

function color_nodes_indip()
{
    let nodes_indip = get_nodes_indip();
    let node;
    for (const i in nodes_indip) {
        let id = nodes_indip[i];
        node = nodes.get(id);
        node.color.background = "orange";
        nodes.update(node);
    }
}

function get_id_from_label_node(string)
{
    for (const e in nodes._data) {
        if (nodes._data[e].label === string) {
            return e;
        }
    }
}

function get_edge_id_from_endpoints(src,dest)
{
    for (const e in fg_edges._data)
    {
        let edge=fg_edges._data[e]
        if ((edge.from==src && edge.to==dest)||
        (edge.from==dest && edge.to==src))
            return edge.id    
    }
}

function get_factor_id_from_label_node(string)
{
    for (const e in fg_nodes._data) {
        if (fg_nodes._data[e].label === string) {
            return e;
        }
    }
}
function get_id_from_label_edges(from, to)
{
    let from_id = get_id_from_label_node(from);
    let to_id = get_id_from_label_node(to);
    for (const e in edges._data) {
        if (edges._data[e].from == from_id && edges._data[e].to == to_id)
            return e;
    }
}

function get_to_edges_from_node(node_id) {
    let ret_edges = [];
    for (const e in edges._data) {
        if (edges._data[e].from == node_id) {
            ret_edges.push(e);
        }
    }
    return ret_edges;
}

function get_from_edges_to_node(node_id) {
    let ret_edges = [];
    for (const e in edges._data) {
        if (edges._data[e].to == node_id) {
            ret_edges.push(e);
        }
    }
    return ret_edges;
}

function hide_error_success() {
    $("#error_dialog").hide();
    $("#success").hide();
}

$("#button_new").click(function() {
    nodes.clear();
    edges.clear();
    network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
    activate_interactions()
    $("#name_choice").text("Select a button please...");
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_node").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_nodes").hide();

    

});

$("#button_open_file_hidden").change(function() {
    /*
    Hidden button to use for opening a file window, to open an .xml file containing a graph using the XMLBIF format.
     */
    let file = $(this)[0].files[0];
    $("#fileName").text(file.name);

    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert('The File APIs are not fully supported in this browser.');
        return;
    }

    let fr;
    fr = new FileReader();
    fr.onload = receivedText;
    fr.readAsText(file);

    function receivedText() {
        let xmlbif = fr.result;
        let xmlDoc = $.parseXML(xmlbif);
        let $xml = $(xmlDoc);
        load_network($xml);
    }
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_node").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_nodes").hide();
    $("#name_choice").text("Select a button please...");

});

$(".example").click(function(params)
{
    let file="XMLBIF%20Examples/"+params.target.text
    $.ajax({
        'url': file,
        type: "GET",
        dataType: "xml",
        success: function (response) {
            var ns = new XMLSerializer();
            var ss= ns.serializeToString(response);
            let xmlDoc = $.parseXML(ss);
            let $xml = $(xmlDoc);
            load_network($xml)
        },
    });
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_node").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_nodes").hide();
    $("#name_choice").text("Select a button please...");

})

$("#button_save_file").click(function() {
    /*
    Function to query the server to generate a valid XMLBIF file to be saved from the current network.
     */


    var ElementTree = et.ElementTree;
    var Element = et.Element;
    var SubElement = et.SubElement;

    bif = Element('BIF')
    bif.set("VERSION", "0.3")
    bif.set("xmlns", "http://www.cs.ubc.ca/labs/lci/fopi/ve/XMLBIFv0_3")
    bif.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    bif.set("xsi:schemaLocation", "http://www.cs.ubc.ca/labs/lci/fopi/ve/XMLBIFv0_3 http://www.cs.ubc.ca/labs/lci/fopi/ve/XMLBIFv0_3/XMLBIFv0_3.xsd")
    network = SubElement(bif, "NETWORK")
    nm = SubElement(network, "NAME")
    nm.text = "Untitled"
    property_1 = SubElement(network, "PROPERTY")
    property_1.text = "detailed = "
    property_2 = SubElement(network, "PROPERTY")
    property_2.text = "detailed = "
    for (node in nodes._data)
    {
        variable = SubElement(network, "VARIABLE")
        variable.set("TYPE", "nature")
        varname = SubElement(variable, "NAME")
        varname.text = nodes._data[node]['label']
        domain = nodes._data[node]['domain']
        for (d of domain)
        {
            outcome = SubElement(variable, "OUTCOME")
            outcome.text = d
        }
        property = SubElement(variable, "PROPERTY")
        property.text = "position = (0.0, 0.0)"
        definition = SubElement(network, "DEFINITION")
        def_for = SubElement(definition, "FOR")
        def_for.text = nodes._data[node]['label']
        given = nodes._data[node]['probability']['given']
        table = nodes._data[node]['probability']['table']
        for (g of given)
        {
            def_given = SubElement(definition, "GIVEN")
            def_given.text = nodes._data[g]['label']
        }
        def_table = SubElement(definition, "TABLE")
        def_table.text = table.join(" ")
    }
    etree = new ElementTree(bif);
    xml = format(etree.write({'xml_declaration': true,'encoding':'utf-8', 'method':"xml"}),{collapseContent: true});
    var blob = new Blob([xml], {type: 'text/xml'});
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, "graph.xml");
    } else {
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = "graph.xml";
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    }

});

function load_network(xml){
    /*
    Function that parses the XMLBIF file and generates the corresponding network
     */
    nodes.clear();
    edges.clear();
    network = new vis.Network(container, {nodes: nodes, edges: edges}, {});

    let center_x = 0;
    let center_y = 0;

    let variables = xml.find('VARIABLE');
    variables.each(function(i){
        let variable = {};

        variable.id = i;
        variable.name = $(this).find('NAME').text();

        variable.domain = [];
        let domain = $(this).find('OUTCOME');
        domain.each(function(){
            let value = $(this).text();
            variable.domain.push(value);
        });

        let pos = {};
        let position = $(this).find('PROPERTY').text();
        position = position.split("(")[1];
        position = position.split(",");
        pos.x = position[0];
        position = position[1].split(" ").join("");
        pos.y = position.split(")")[0];

        let x, y;
        if (center_x === 0 && center_y === 0) {
            x = 0;
            y = 0;
            center_x = pos.x;
            center_y = pos.y;
        } else {
            x = pos.x - center_x;
            y = pos.y - center_y;
        }

        nodes.add({
            id: variable.id,
            label: variable.name,
            x: x,
            y: y,
            domain: variable.domain,
            color: {background: "", border: "black"},
        });
    });

    let edge_counter = 0;
    let probabilities = xml.find('DEFINITION');
    probabilities.each(function(){
        let target_node_id = get_id_from_label_node($(this).find('FOR').text());

        let given_nodes_id = [];
        $(this).find('GIVEN').each(function(){
            let given = $(this).text();
            let given_node_id = get_id_from_label_node(given);
            given_nodes_id.push(given_node_id);
        });

        for (const from in given_nodes_id) {
            edges.add({
                id: edge_counter,
                from: given_nodes_id[from],
                to: target_node_id,
                arrows: 'to'
            });
            edge_counter++;
        }

        let probability_table = $(this).find('TABLE').text().split(" ");

        let node = nodes._data[target_node_id];
        node.probability = {};
        node.probability.given = given_nodes_id;
        node.probability.table = probability_table;
    });
    activate_interactions()
}

function activate_interactions()
{
network.on( 'click', function(properties) {
	let option_selected = $("#name_choice").text();

	hide_error_success();

	if(option_selected === "Set Properties" && properties.nodes.length === 1)
	{
        let node = nodes.get(properties.nodes[0]);
        $("#label_selected").val(node.label);
        $("#domain_selected").val(node.domain);
        $("#set_properties_id").val(node.id);
    }
    else if(option_selected === "Probability Table")
    {
        if (properties.nodes.length !== 0) {
            let node = nodes.get(properties.nodes[0]);
            create_dynamic_probability_table(node.id);
        }
    }
    else if(option_selected === "Delete Node" && properties.nodes.length === 1)
    {
        let node = nodes.get(properties.nodes[0]);
        delete_node(node.id);
        $("#success").show();
    }
    else if(option_selected === "Delete Edge" && properties.edges.length === 1 && properties.nodes.length === 0)
    {
        let edge = nodes.get(properties.edges[0]);
        delete_edge(edge.id);
        $("#success").show();
    }
    else if(option_selected==="Create Edge")
        if (already_selected_node!=undefined && properties.nodes.length === 1)
        {
            let node = nodes.get(properties.nodes[0]);
            create_edge(already_selected_node,node.id)
            already_selected_node=undefined
        }
        else
            if (properties.nodes.length === 1)
            {
                already_selected_node=nodes.get(properties.nodes[0]).id;
            }

});
}
$("#button_create_node").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_nodes").show();

    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Create Node");

});

$("#button_create_edge").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_nodes").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_edge").show();

    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Create Edge");

});

$("#button_delete_node").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_nodes").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_create_edge").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_delete_node").show();
    
    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Delete Node");

});

$("#button_delete_edge").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_nodes").hide();
    $("#div_set_properties").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_delete_edge").show();

    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Delete Edge");

});

$("#button_set_properties").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#div_create_nodes").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_set_properties").show();

    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Set Properties");

});

$("#button_probability_table").click(function() {
    $("#success").hide();
    $("#error_dialog").hide();
    $("#div_create_nodes").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_probability_table").show();

    if ($("#name_choice").text()=="Compute Query")
    {
        network = new vis.Network(container, {nodes: nodes, edges: edges}, {});
        activate_interactions()
    }
    $("#name_choice").text("Probability Table");

   // color_nodes_indip();
});

$("#button_query").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Compute Query");
    $("#div_create_nodes").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_create_edge").hide();
    $("#help_message").hide();
    $("#div_query").show();

    create_dynamic_observations();
    factor_graph=build_graph()
    $('#start').removeAttr("disabled");
    $("#step").attr("disabled",true);
    $("#step_one_round").attr("disabled",true);
    $("#run_to_convergence").attr("disabled",true);
    $("#round").text("Round 0")
});

$("#save_create_node").click(function() {
    hide_error_success();
    let label = $("#label").val();
    let domain = $("#domain").val();

    if(label === "" || domain === "" || domain.toString().split(',').length < 2 || domain.slice(-1) === "," || get_id_from_label_node(label))
        $("#error_dialog").show();
    else {
        let max_id;
        if (nodes.length == 0) {
            max_id = -1;
        } else {
            max_id = Math.max(...Object.keys(nodes._data));
        }
        let dom = domain.split(',');
        let table = [];
        for (const i in dom) {
            table.push(1 / dom.length);
        }
        nodes.add({
            id: max_id + 1,
            label: label,
            domain: dom,
            probability: {given: [], table: table},
            color: {background: "", border: "black"},
        });
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#save_create_edge").click(function() {
    hide_error_success();

    let from = $("#from").val();
    let to = $("#to").val();

    if (!get_id_from_label_node(from) ||
        !get_id_from_label_node(to) ||
        get_id_from_label_edges(from, to))
        $("#error_dialog").show();
    else
    {
        let from_id = get_id_from_label_node(from);
        let to_id = get_id_from_label_node(to);
        create_edge(from_id,to_id)
    }
});
function create_edge(from_id, to_id)
{
    let max_id;
    if (edges.length == 0) {
        max_id = -1;
    } else {
        max_id = Math.max(...Object.keys(edges._data));
    }
    edges.add({
        id: max_id + 1,
        from: parseInt(from_id),
        to: parseInt(to_id),
        arrows: 'to'
    });
    let to_node = nodes.get(to_id);
    to_node.probability.given.push(from_id);
    update_probabilities(to_id);
    $("#error_dialog").hide();
    $("#success").show();

}
$("#save_delete_node").click(function() {
    hide_error_success();

    let delete_node = $("#delete_node").val();

    let id = get_id_from_label_node(delete_node);

    if(!id)
    	$("#error_dialog").show();
    else
    {
        delete_node(id);
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#save_delete_edge").click(function() {
    hide_error_success();

    let from = $("#delete_from").val();
    let to = $("#delete_to").val();

    let id = get_id_from_label_edges(from, to);

    if (!get_id_from_label_node(from) ||
        !get_id_from_label_node(to) ||
        get_id_from_label_edges(from, to))
        $("#error_dialog").show();
    else
    {
        delete_edge(id);
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#save_set_properties").click(function() {
    let id = $("#set_properties_id").val();
    let new_label = $("#label_selected").val();
    let new_domain = $("#domain_selected").val().split(",");

    if (new_label === "" || new_domain.toString().split(',').length < 2 || new_domain.slice(-1)===","){
        $("#success").hide();
        $("#error_dialog").show();
    } else {
        let node = nodes.get(id);
        node.label = new_label;
        node.domain = new_domain;
        nodes.update(node);
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#step").click(function() {
    factor_graph.step()
    
});

$("#step_one_round").click(function() {
    $('#start').attr('disabled',true)
    let old_round=round
    while (round<old_round+1)
        factor_graph.step()

        
});

$("#run_to_convergence").click(function() {
    /*
    loop until max_iterations=10000 that propagates
    messages from variables to factors and vice-versa, using parallel message passing.
    The method used is described in the book at
    http://web4.cs.ucl.ac.uk/staff/D.Barber/textbook/091117.pdf from page 88.
    */
    $('#start').attr('disabled',true)
    let old_round=round
    while (epsilon>1e-5 && round<=10000)
    {
        if (old_round!=round)
        {
            let marg=factor_graph.get_marginals()
            epsilon=compare_marginals(marg,last_marginals)
            old_round=round
            last_marginals=marg
        }
        factor_graph.step()
    }

        
});

$("#start").click(function() {
    /*
    Function that queries the server in order to compute the marginal for the specified node.
    It also considers observations (evidences) that were set previously in the specific section of the page.
    By default observations are set to "NO" which means they are disabled for every node.
    They are opt-in for every node.
     */

    observations = {}
    $("#observations > div.row").find("div.btn-group").each(function() {
        let choice = $(this).find("label.active > input")[0];
        observations[this.id] = choice.value;
    });
    observe(factor_graph, observations)
    cur_marginals = factor_graph.get_marginals()
    for (const var_n in cur_marginals)
    {
        let var_node =fg_nodes.get(var_n);
        let a = var_node['label'].split("\n");
        let node_marg=cur_marginals[parseInt(var_n)]
        let marginals=node_marg.mapElems(x=>x.toFixed(2))
        let marg_arr=marginals.toNestedArray()
        let new_lab=a[0]+"\n["+marg_arr+"]"
        let full_marg_arr=node_marg.toNestedArray()
        let title="<table><thead><tr>"
        for (const index in full_marg_arr)
            title+="<th>"+var_node.domain[index]+"</th>"
        title+="</tr></thead><tbody><tr>"
        for (const index in full_marg_arr)
           title+="<td>"+full_marg_arr[index]+"</td>"
           title+="</tr></tbody></table>"
        
        fg_nodes.update([{id: var_n, label: new_lab, 'title':title}]);

    }    
    g.start()
    for (const n of all_fg_nodes)
        if (n instanceof Factor)
        {
            let title=create_factor_table(n.name)
            fg_nodes.update({id:n.name,'title':title})
        }
    $('#start').attr('disabled',true)
    $("#step").removeAttr("disabled");
    $("#step_one_round").removeAttr("disabled");
    $("#run_to_convergence").removeAttr("disabled");
    fg_network.on("hoverNode", function (params) {
    })
    fg_network.on("hoverEdge", function (params) {
    })
});
function observe(graph, observations)
{
    for (o in observations)
    {
        if (observations[o]>=0)
        {
            graph.set_evidence(o, observations[o])
        }
    }
}
function ones(size)
{
    return nd.tabulate([size], (i) => 1);
}
function zeros(size)
{
    return nd.tabulate([size], (i) => 0);
}
class Node 
/* class encoding a node of a factor graph */
{
/*      name: Name of the node
        mailbox: structure that contains the messages received
        connections: structure that contains references to the nodes connceted to this node
*/
    name;
    mailbox;
    connections;
    constructor(name){
        this.name = name
        this.mailbox = {}
        this.connections = []
    }
    append(dest_node){
        /*
        With this method, we update the connections list of this node and the destination node.
        */
        this.connections.push(dest_node)
        dest_node.connections.push(this)
    }

    propagate(step_number, mu){
        /*
        Propagate the message vector mu @step_number
        */
        if (!this.mailbox[step_number])
        {
            this.mailbox[step_number] = [mu];
        }
        else
        {
            this.mailbox[step_number].push(mu);
        }
        let edge_id=get_edge_id_from_endpoints(this.name,mu.source_node.name)
        let label=fg_edges.get(edge_id).label
        let title=fg_edges.get(edge_id).title
        let lines=label.split("\n")
        let message=mu.value.mapElems(x=>x.toFixed(2))
        let mess_array=message.toNestedArray()
        let full_mess_array=mu.value.toNestedArray()
        let title_lines=title.split("\n")
        old_edge_id=edge_id
        if (this instanceof Factor)
        {
            let mess="v->f"+"["+mess_array+"]"
            let new_lab=lines[0]+"\n<b>"+mess+"</b>"
            let title_mess="<td>v->f</td>"
            for (let m in full_mess_array)
                title_mess+="<td>"+full_mess_array[m]+"</td>"
            let new_title=title_lines[0]+"\n"+title_lines[1]+"\n<tr>"+title_mess+"</tr>\n"+title_lines[3]
            fg_edges.update({id:edge_id,label:new_lab,'title':new_title})

            old_edge_label=lines[0]+"\n"+mess
        }
        else
        {
            let mess="f->v"+"["+mess_array+"]"
            let new_lab="<b>"+mess+"</b>\n"+lines[1]

            let title_mess="<td>f->v</td>"
            for (let m in full_mess_array)
                title_mess+="<td>"+full_mess_array[m]+"</td>"
            let new_title=title_lines[0]+"\n<tr>"+title_mess+"</tr>\n"+title_lines[2]+"\n"+title_lines[3]
            fg_edges.update({id:edge_id,label:new_lab,'title':new_title})
            old_edge_label=mess+"\n"+lines[1]
        }
    }
}

class Variable extends Node
/* class encoding a variable node of a factor graph */
{
    size;
    observed_state;
    constructor(name, size){
        super(name)
        this.size = size
        this.observed_state = null
    }
    marginal(){
        /*
        To calculate the marginal, the method used is described in the book at
        http://web4.cs.ucl.ac.uk/staff/D.Barber/textbook/091117.pdf from page 88.
        We use logarithmic values to reduce errors of propagation in big networks.
        */
        if(this.observed_state!=undefined)
        {
            let marg=zeros(this.size)
            marg.set([this.observed_state],1.0)
            return marg
        }
        else
            if (Object.keys(this.mailbox).length)
            {
                let mus = this.mailbox[Math.max(...Object.keys(this.mailbox))]
                let product_output=ones(this.size)
                for (const mu of mus)
                {
                    product_output=nd.zip_elems([product_output,mu.value],(a_ij,b_ij, i,j) =>  a_ij * b_ij)
                }
                let marg_array=product_output.toNestedArray()
                let sum=marg_array.reduce( (x,y) => x+y ) 
                return product_output.mapElems((x)=>x/sum)
        
            }
            else
            {
                let marginals=nd.zip_elems([ones(this.size)],(x)=>x/this.size)
                return  marginals;
            }
    }
    create_message(dest)
    {
        if (this.connections.length != 1)
        {
            let mus_not_filtered = this.mailbox[Math.max(...Object.keys(this.mailbox))]

            let mus = mus_not_filtered.filter(mu=>mu.source_node != dest)
            let product_output=ones(this.size)
            for (const mu of mus)
            {
                product_output=nd.zip_elems([product_output,mu.value],(a_ij,b_ij, i,j) =>  a_ij * b_ij)
            }

            return product_output 
        }
        else
            return ones(this.size)
    }
}

class Factor extends Node
/* class encoding a factor of a factor graph */
{
    potential;
    constructor(name, potentials){
        super(name)
        this.potential = potentials
    }


    reshape_mu(mu)
    {
        /*
        This methods reshapes the mu vector to be used for computation in the next steps (since product of vectors
        requires specific vector shapes).
        */
        let dims = this.potential.shape

        let accumulator = nd.tabulate(dims,(x)=>1.0)
        let message=mu.value.data
        let index =this.connections.indexOf(mu.source_node)
        for (const [coordinate,el] of this.potential.elems())
        {
            let c = coordinate[index]
            let val=message[c]
            accumulator.set([...coordinate],val)
        }
        return accumulator
    }

    sum(potential, node)
    {
        let res = zeros(node.size)
        let index =this.connections.indexOf(node)
        for (const [coordinate,el] of this.potential.elems())
        {
            if (coordinate.length==0)
            {
                res.modify([0],x=>x + pot)
            }
            else
            {
                let c = coordinate[index]
                let pot=potential(...coordinate)
                res.modify([c],x=>x + pot)
            }
        }
        return res
    }

    create_message(dest)
    {
        if (this.connections.length != 1)
        {
            let mus_not_filtered = this.mailbox[Math.max(...Object.keys(this.mailbox))]
            let mus = mus_not_filtered.filter(mu=>  mu.source_node != dest)
            let all_mus = mus.map(mu=>this.reshape_mu(mu))
            let product_output=this.potential
            for (const mu of all_mus)
            {
                product_output=nd.zip_elems([product_output,mu],(a_ij,b_ij, i,j) =>  a_ij * b_ij)
            }
            let res=this.sum(product_output,dest)
            return res
        }
        else
            return this.sum(this.potential, dest)
    }



}

class Mu
{

    constructor(source_node, value)
    {
        this.source_node = source_node
        let val_flat = value.reshape(-1)
        let val_flat_array=val_flat.toNestedArray()
        let sum=val_flat_array.reduce( (x,y) => x+y ) 
        this.value= val_flat.mapElems((x)=>x/sum)
    }
}

class FactorGraph
/* class encoding a factor graph */
{    
    nodes;

    constructor()
    {
        this.nodes = {}
    }

    start()
    /* starting inference */
    {
        round=0
        $("#round").text("Round "+round)
        epsilon = 1
        all_fg_nodes=Object.values(this.nodes)

        for (const node of all_fg_nodes)
            node.mailbox={}
        cur_marginals = this.get_marginals()

        for (node of all_fg_nodes)
            if (node instanceof Variable)
            {
                let message = new Mu(node, ones(node.size))
                for (const dest of node.connections)
                {
                    dest.propagate(round, message)
                    fg_edges.update({id:old_edge_id,label:old_edge_label})
                }

            }
        let vars = all_fg_nodes.filter(node=> node instanceof Variable)
        let fs = all_fg_nodes.filter(node=>node instanceof Factor)
        sender_nodes = fs.concat(vars)
        next_sender=sender_nodes.shift()
        next_dests=[...next_sender.connections]
        last_marginals = this.get_marginals()

    }

    step()
    {
        fg_edges.update({id:old_edge_id,label:old_edge_label})

        if (next_dests.length==0)
        {
            do
            {
                if (sender_nodes.length==0)
                {
                    round+=1
                    $("#round").text("Round "+round)
                    let vars = all_fg_nodes.filter(node=> node instanceof Variable)
                    let fs = all_fg_nodes.filter(node=>node instanceof Factor)
                    sender_nodes = fs.concat(vars)
                }
                else
                    next_sender=sender_nodes.shift()
                next_dests = [...next_sender.connections]
            }
            while (next_dests.length==0)
        }

        let dest=next_dests.shift()
        let value = next_sender.create_message(dest)
        let msg =new  Mu(next_sender, value)
        dest.propagate(round, msg)
        cur_marginals = this.get_marginals()
        for (const var_n in cur_marginals)
        {
            let var_node =fg_nodes.get(var_n);
            let a = var_node['label'].split("\n");
            let node_marg=cur_marginals[parseInt(var_n)]
            let marginals=node_marg.mapElems(x=>x.toFixed(2))
            let marg_arr=marginals.toNestedArray()
            let new_lab=a[0]+"\n["+marg_arr+"]"
            let full_marg_arr=node_marg.toNestedArray()
            let title="<table><thead><tr>"
            for (const index in full_marg_arr)
                title+="<th>"+var_node.domain[index]+"</th>"
            title+="</tr></thead><tbody><tr>"
            for (const index in full_marg_arr)
                title+="<td>"+full_marg_arr[index]+"</td>"
            title+="</tr></tbody></table>"
            fg_nodes.update([{id: var_n, label: new_lab, 'title':title}]);

        }
    }

    add(node)
    {
        this.nodes[node.name] = node
    }

    append(source_node_name, dest_node)
    {
        dnn = dest_node.name
        if (!(this.nodes.get(dnn, 0)))
            this.nodes[dnn] = dest_node
        this.nodes[source_node_name].push(this.nodes[dnn])
        return this
    }

    connect(name1, name2)
    {
        this.nodes[name1].append(this.nodes[name2])
    }

    set_evidence(name, state)
    {
        node = this.nodes[name]
        node.observed_state=parseInt(state)
 
        factors=node.connections.filter(conn=> conn instanceof Factor)
        for (const f of factors)
        {
            if (f.connections.length==1)
            {
                f.connections=[]
            }
            else
            {
                let del_ax = f.connections.indexOf(node)
                let del_dims_int_arr=f.potential.shape
                let del_dims=[]
                for (const i in del_dims_int_arr)
                { 
                    del_dims.push(del_dims_int_arr[i])
                }
                del_dims.splice(del_ax,1)
                let slice=[]
                for (const sl in f.connections)
                {
                    if (sl!=del_ax)
                        slice.push([,,])
                    else
                        slice.push(parseInt(state))
                }
                f.potential = f.potential.sliceElems(...slice)
                f.connections.splice(del_ax,1)
            }
        }

        node.connections = []
    }

    get_marginals()
    {
        let marg={};
        let nodes_array= Object.values(this.nodes)
        let vars=nodes_array.filter(x=>x instanceof Variable)
        for (const n of vars)
            marg[n.name]=n.marginal();
        return marg
    }
}
function compare_marginals(marginal_1, marginal_2)
/* computes the sum of the absolute difference of the components of two marginals */
{
    let sum=0
    for (const n in marginal_1)
    {
        let c = nd.zip_elems([marginal_1[n],marginal_2[n]], (a,b) => Math.abs(a-b) )
        sum+=c.reduceElems((x,y)=>x+y)
    }
    return sum
}

function build_graph()
{
    fg_nodes.clear();
    fg_edges.clear();
    fg_network = new vis.Network(container, {nodes: fg_nodes, edges: fg_edges}, { interaction:{hover:true}});
    single_factors = {}
    g = new FactorGraph()
    let max_id_nodes;
    if (nodes.length == 0) {
        max_id_nodes = -1;
    } else {
        max_id_nodes = Math.max(...Object.keys(nodes._data));
    }
    factors = []
for (node in nodes._data)
    {
        node_name = nodes._data[node]['label']
        node_domain = nodes._data[node]['domain']
        node_given = nodes._data[node]['probability']['given']
        node_variable = new Variable(parseInt(node), node_domain.length)
        marginal_array=node_variable.marginal().toNestedArray();
        marginals=marginal_array.map(x=>x.toFixed(2))
        fg_nodes.add({
            id: parseInt(node),
            label: node_name+"\n["+marginals+"]",
            domain: node_domain,
            color: {background: "", border: "black"},
        });


        g.add(node_variable)
        factor_name = 'f_' + node
        probability_table = nodes._data[node]['probability']['table']
        probabilities = nd.array(probability_table)
        shape = []
        for (n of node_given)
        {
            n_domain = nodes._data[n]['domain']
            shape.push(n_domain.length)
        }
        shape.push(node_domain.length)
        probabilities=nd.NDArray.prototype.reshape.apply(probabilities,shape);

        node_id= max_id_nodes+parseInt(node)+1;
        fg_nodes.add({
            id: node_id,
            label: factor_name,
            color: {background: "", border: "black"},
            shape: "box",
            font: { multi: true }
        });
        factor = new Factor(node_id, probabilities)
        g.add(factor)
        factors.push({'factor':factor, 'var': node, 'given': node_given, 'factor_name': factor_name})
    }
    for (factor of factors)
    {
        node_given = factor['given'] 
        
        factor_name = factor['factor_name']
        let from = get_factor_id_from_label_node(factor_name);
        let variab=factor['var']
        for (n of factor['given'])
        {
            let to = parseInt(n);
            if (fg_edges.length == 0) {
                max_e_id = -1;
            } else {
                max_e_id = Math.max(...Object.keys(fg_edges._data));
            }

            let var_node =fg_nodes.get(n);
            let title="<table><thead><tr><th></th>"
            for (const index in var_node.domain)
                title+="<th>"+var_node.domain[index]+"</th>"
            title+="</tr></thead><tbody>\n<tr><td>f->v</td>"
            for (const index in var_node.domain)
                title+="<td></td>"
            title+="</tr>\n<tr><td>v->f</td>"
            for (const index in var_node.domain)
                title+="<td></td>"
            title+="</tr>\n</tbody></table>"


            fg_edges.add({
                id: max_e_id + 1,
                from: parseInt(from),
                to: parseInt(to),
                label: "f->v\nv->f",
                title: title,
                font: { multi: true }
                });
            g.connect(from,to);
            
         }
        if (fg_edges.length == 0) {
            max_e_id = -1;
        } else {
            max_e_id = Math.max(...Object.keys(fg_edges._data));
        }
        let var_node =fg_nodes.get(parseInt(variab));
        let title="<table><thead><tr><th></th>"
        for (const index in var_node.domain)
            title+="<th>"+var_node.domain[index]+"</th>"
        title+="</tr></thead><tbody>\n<tr><td>f->v</td>"
        for (const index in var_node.domain)
            title+="<td></td>"
        title+="</tr>\n<tr><td>v->f</td>"
        for (const index in var_node.domain)
            title+="<td></td>"
        title+="</tr>\n</tbody></table>"

        fg_edges.add({
            id: max_e_id + 1,
            from: parseInt(from),
            to: parseInt(variab),
            label: "f->v\nv->f",
            title: title,
            font: { multi: true }
        });
     g.connect(from,factor['var'])
      }

    return g
    
    
}


function create_factor_table(node_id) {
    let node = all_fg_nodes[node_id];
    let table = "<table>";
    table += "<thead id='thead'><tr>";
    let str;
    if (node.connections.length == 0) {
            str =  node.potential(0);
            let nodef = fg_nodes.get(node_id)
            table += "<th>"+nodef.label+"</th></tr></thead><tbody><tr><td>" + str + "</td></tr>";
    } else {
        let node_from;
        for (const i in node.connections) {
            node_from=fg_nodes.get(node.connections[i].name)
            let lab=node_from.label
            node_from_la = lab.split("\n")
            table += "<th>" + node_from_la[0] + "</th>";
        }
        let nodef = fg_nodes.get(node_id)
        table += "<th>"+nodef.label+"</th></tr></thead><tbody>";
        let prob = generate_index_arrays_factor(node_id);
        for (const p in prob) {
                let index = prob[p];
                for (const element in index) {
                    let node_id = node.connections[element].name;
                    let node_id_domain = nodes.get(node_id).domain;
                    str = node_id_domain[index[element]];
                    table += "<td>" + str + "</td>";
                }
                let prob_value = node.potential(...index);
                table += "<td style='text-align: center'>" + prob_value + "</td></tr>";
        }
    }
    table += "</tbody></table></div>";
    return table
}


function create_dynamic_probability_table(node_id) {
    let node = nodes.get(node_id);
    let table = "<div id='dynamic_table_div'><table id='dynamic_table' class='table table-hover mt-4'>";
    table += "<thead id='thead'><tr class='table-primary text-center'>";
    let str;
    if (node.probability.given.length == 0) {
        for (const i in node.domain) {
            str = node.label + " (" + node.domain[i] + ")";
            table += "<th><strong>" + str + "</strong></th>";
        }
        table += "</tr></thead><tbody>";
        table += "<tr class='table-dark text-center'>";
        for (let i = 0; i < node.domain.length; i++) {
            str = "<input name=" + i + " style='text-align: center' value=" + node.probability.table[i] + ">";
            table += "<td>" + str + "</td>";
        }
    } else {
        let node_from;
        for (const i in node.probability.given) {
            node_from = nodes.get(node.probability.given[i]);
            table += "<th><strong>" + node_from.label + "</strong></th>";
        }
        for (const i in node.domain) {
            str = node.label + " (" + node.domain[i] + ")";
            table += "<th><strong>" + str + "</strong></th>";
        }
        table += "</tr></thead><tbody>";
        let prob = generate_index_arrays(node.id);
        let skipper = node.domain.length - 1;
        for (const p in prob) {
            if (skipper == node.domain.length - 1) {
                table += "<tr class='table-dark text-center'>";
                let index = prob[p];
                index.pop();
                for (const element in index) {
                    let node_id = node.probability.given[element];
                    let node_id_domain = nodes.get(node_id).domain;
                    str = node_id_domain[index[element]];
                    table += "<td><strong>" + str + "</strong></td>";
                }
                for (const d in node.domain) {
                    index.push(parseInt(d));
                    let prob_value = get_probability(node.id, index);
                    let name = index.join(',');
                    table += "<td><input name=" + name + " style='text-align: center' value=" + prob_value + "></td>";
                    index.pop();
                }
            }
            skipper--;
            if (skipper == -1) {
                skipper = node.domain.length - 1;
            }
        }
    }
    table += "</tbody></table></div>";
    let button = '<button id="button_update_probabilities" type="button" class="btn btn-primary mt-3">Update Probabilities</button>';
    $("#div_probability_table").html(table);
    $("#div_probability_table").append(button);
    $("#button_update_probabilities").click(function() {
        check_and_update_probabilities(node_id)
    });
}

function check_and_update_probabilities(node_id) {
    let not_valid = 0;
    $("#dynamic_table > tbody").find('tr').each(function() {
        let values = [];
        $(this).find('input').each(function() {
            values.push(this.value);
        });
        let tot = 0;
        for (let i = 0; i < values.length; i++) {
            tot += parseFloat(values[i]);
        }
        if (tot !== 1)
            not_valid += 1;
    });
    if (not_valid == 0) {
        $("#dynamic_table > tbody").find('tr').each(function() {
            $(this).find('input').each(function() {
                let value = this.value;
                let array = $(this).attr('name').split(',');
                set_probability(node_id, array, parseFloat(value));
            });
        });
        $("#success").show();
        $("#error_dialog").hide();
    } else {
        $("#success").hide();
        $("#error_dialog").show();
    }
}

function create_dynamic_observations() {
    function get_html_group(content, node_id) {
        return '<div id="' + node_id + '" class="btn-group btn-group-toggle" data-toggle="buttons">' + content + '</div>';
    }

    function get_html_row(content) {
        return '<div class="row">' + content + '</div>';
    }

    function get_html_col_6(content) {
        return '<div class="col-6">' + content + '</div>';
    }

    function get_html_col_3(content) {
        return '<div class="col-3">' + content + '</div>';
    }

    function get_html_name(node_name) {
        return '<div class="form-check form-check-inline"><label class="form-check-label">' + node_name + ': ' + '</label></div>'
    }

    function get_html_option(option, label) {
        return '<label class="btn btn-secondary"><input name="options" type="radio" value="' + option + '">' + label + '</label>';
    }

    function get_html_choose() {
        return '<label class="btn btn-danger active"><input name="options" type="radio" value="-1">NO</label>';
    }

    let html_out = "";

    let node;
    for (const n in nodes._data) {
        let html = "";
        node = nodes.get(n);
        let name = get_html_name(node.label);
        let options = "";
        for (const d in node.domain) {
            options += get_html_option(d, node.domain[d]);
        }
        let choose = get_html_choose();
        let opt = get_html_group(options + choose, node.id);
        html += get_html_col_3(name);
        html += get_html_col_6(opt);
        html_out += get_html_row(html);
    }

    $("#observations").html(html_out);
}