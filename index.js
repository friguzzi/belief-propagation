nodes = new vis.DataSet([]);
edges = new vis.DataSet([]);
container = document.getElementById('graph');
network = new vis.Network(container, {nodes: nodes, edges: edges}, {});

function get_domain_from_id(id_node)
{
    for (const e in nodes._data) {
        if (e == id_node) {
            return nodes._data[e].domain.split(',');
        }
    }
}

function get_label_from_id(id_node)
{
    for (const e in nodes._data) {
        if (e == id_node) {
            return nodes._data[e].label;
        }
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

function get_id_from_label_edges(from, to)
{
    let from_id = get_id_from_label_node(from);
    let to_id = get_id_from_label_node(to);
    for (const e in edges._data) {
        if (edges._data[e].from == from_id && edges._data[e].to == to_id)
            return e;
    }
}

function hide_error_success() {
    $("#error_dialog").hide();
    $("#success").hide();
}

$("#button_open_file_hidden").change(function() {
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
});

function load_network(xml){
    nodes.clear();
    edges.clear();

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

        let node = nodes.get(target_node_id);
        node.probability = {};
        node.probability.given = given_nodes_id;
        node.probability.table = probability_table;
    });
}

network.on( 'click', function(properties) {
    console.log(properties);
    console.log(nodes);
    console.log(edges);

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
    }
    else if(option_selected === "Delete Node" && properties.nodes.length === 1)
    {
        let node = nodes.get(properties.nodes[0]);
        nodes.remove(node);
        $("#success").show();
    }
    else if(option_selected === "Delete Edge" && properties.edges.length === 1 && properties.nodes.length === 0)
    {
        let edge = nodes.get(properties.edges[0]);
        edges.remove(edge);
        $("#success").show();
    }
});

$("#button_create_node").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Create Node");
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_nodes").show();
});

$("#button_create_edge").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Create Edge");
    $("#div_create_nodes").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_create_edge").show();
});

$("#button_delete_node").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Delete Node");
    $("#div_create_nodes").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_create_edge").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_delete_node").show();
});

$("#button_delete_edge").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Delete Edge");
    $("#div_create_nodes").hide();
    $("#div_set_properties").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_delete_edge").show();
});

$("#button_set_properties").click(function() {
    $("#error_dialog").hide();
    $("#success").hide();
    $("#name_choice").text("Set Properties");
    $("#div_create_nodes").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_probability_table").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_set_properties").show();
});

$("#button_probability_table").click(function() {
    $("#success").hide();
    $("#error_dialog").hide();
    $("#name_choice").text("Probability Table");
    $("#div_create_nodes").hide();
    $("#div_create_edge").hide();
    $("#div_delete_node").hide();
    $("#div_delete_edge").hide();
    $("#div_set_properties").hide();
    $("#div_query").hide();
    $("#help_message").hide();
    $("#div_probability_table").show();
});

$("#save_create_node").click(function() {
    hide_error_success();
    let label = $("#label").val();
    let domain = $("#domain").val();

    if(label === "" || domain === "" || domain.toString().split(',').length < 2 || domain.slice(-1) === "," || get_id_from_label_node(label))
        $("#error_dialog").show();
    else {
        let max_id = Math.max(...Object.keys(nodes._data));
        nodes.add({
            id: max_id + 1,
            label: label,
            domain: domain,
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
        let max_id = Math.max(...Object.keys(edges._data));
        let from_id = get_id_from_label_node(from);
        let to_id = get_id_from_label_node(to);
        edges.add({
            id: max_id + 1,
            from: from_id,
            to: to_id,
            arrows: 'to'
        });
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#save_delete_node").click(function() {
    hide_error_success();

    let delete_node = $("#delete_node").val();

    let id = get_id_from_label_node(delete_node);

    if(!id)
    	$("#error_dialog").show();
    else
    {
    	nodes.remove(id);
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("#save_delete_edge").click(function() {
    hide_error_success();

    let from = $("#delete_from").val();
    let to = $("#delete_to").val();

    if (!get_id_from_label_node(from) ||
        !get_id_from_label_node(to) ||
        get_id_from_label_edges(from, to))
        $("#error_dialog").show();
    else
    {
        let id = get_id_from_label_edges(from, to);
        edges.remove(id);
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
        console.log(node);
        node.label = new_label;
        node.domain = new_domain;
        nodes._data[id] = node;
        $("#error_dialog").hide();
        $("#success").show();
    }
});

$("body").on("click", "#check_value", function(event){
    //salgo di livello fino ad arrivare alla tabella 
    var dynamic_flag = $(this).parent().parent().index();

    //CONTROLLO che tutti i valori siano <= 1
    var html = $(this).parent().parent().html();
    //conto quanti input ci sono
    var count_input = (html.match(/input/g) || []).length;

    var total_param=0;
    var val = $(this).parent().parent().children().find('input').each(function(){
    	var param_i = parseFloat(($(this).val()));
    	total_param += param_i;
    });
    
    //controllo
    if(total_param === 1)
    {
    	($(this)).attr("class", "btn btn-success");
    	($(this)).html("✓");
    }
    else
    {
    	($(this)).attr("class", "btn btn-danger");
    	($(this)).html("✗");
    }
});

//////////////////////////////////////////////////////////////////////////////////////////

//voglio risolvere una query
$("#button_query").click(function() {
    //grafica 
    $("#error_dialog").hide();
    $("#success").hide(); 
    $("#name_choice").text("Compute Query");
    $("#div_create_nodes").hide();
    $("#div_delete_node").hide();
    $("#div_delete_arc").hide();
    $("#div_set_properties").hide();
    $("#div_probability_table").hide();
    $("#div_create_arc").hide();
    $("#help_message").hide();
    $("#div_query").show();  
    help_flag=0;
});

//risolvo la query
$("#compute_query").click(function() {
	console.log(network);
});

//////////////////////////////////////////////////////////////////////////////////////////

function isExistArc(from, to)
{
    //controllo se esiste un arco che collega il nodo from al nodo to
    return getIdFromLabel_edges(from,to);
}

function color_nodes_indip()
{
	var values = $.map(nodes, function(v) { return v; });
	for(var v=0; v<values[2]; v++)
	{
		var c = array_keys_nodes[v];
		var dict = (values[1][c]);
		var id_i = dict.id;
		var label_i = dict.label;
		var domain_i = dict.domain;

		if(indip[0].includes(id_i) === true)
		{
			nodes.update({ id: id_i,  label: label_i, domain: domain_i, title:"", color:{background:"orange",border:"black"} });
		}
		else
		{
			nodes.update({ id: id_i,  label: label_i, domain: domain_i, title:"", color:{background:"#97C2FC",border:"black"} });
		}
	}
}

function getNodesIndip()
{
    //numero di nodi presenti
    //risalgo l'id dei nodi indipendenti per la costruzione delle tabelle di probabilità
    var values = $.map(edges, function(v) { return v; });
    //array di nodi dipendenti
    var array_nodes_dip=[];
    var array_nodes_indip=[];
    
    for(var v=0; v<values[2]; v++)
    {
    	var c = array_keys_edges[v];
    	var dict = (values[1][c]);
    	var to_i = dict.to;
    	array_nodes_dip.push(to_i);
    }
    //elimino le doppie
    var uniqueIds_dip = [];
    $.each(array_nodes_dip, function(i, el){
    	if($.inArray(el, uniqueIds_dip) === -1) 
    		uniqueIds_dip.push(el);
    });
    //dall'array delle chiavi elimino i nodi a cui punta un "to"
    array_nodes_indip = array_keys_nodes.slice();
    for(var i=0; i<uniqueIds_dip.length; i++)
    {
    	var elem = parseInt(uniqueIds_dip[i].toString());
    	var index = array_nodes_indip.indexOf(elem);
    	if (index > -1) {
    		array_nodes_indip.splice(index, 1);
    	}
    }
    return array_nodes_indip;
}



function getIdArc_eges(from, to)
{
    //dalla label risalgo al suo id
    var values = $.map(edges, function(v) { return v; });
    
    //grafo vuoto, nessun arco
    if(values.length===0)
    	return 0;
    
    for(var v=0; v<values[2]; v++)
    {
    	var c = array_keys_edges[v];
    	var dict = (values[1][c]);
        //il nodo non esiste nel grafico
        if(dict === undefined)
        	return 0;
        var id_i = dict.id;  
        var from_i = dict.from;
        var to_i = dict.to;
        if(from_i === from && to_i === to){
        	return id_i;
        }
    }
    return 0;
}

function getAllDomainConnectedToId(node_id_selected)
{
    //prima mi servono gli id dei vari nodi
    var nodes_connected = findNodesConnected_To(node_id_selected);
    
    if(nodes_connected.length === 0)
    {
        //vuol dire che non ci sono archi entranti al nodo
        return [];
    }
    else
    {
        //adesso per ogni id vado a salvarmi i loro domini
        var allDomain = [];
        for (var i=0; i<nodes_connected.length; i++)
        {
        	var domain_i = getDomainFromId(nodes_connected[i]);
        	allDomain.push(domain_i);
        }
        return allDomain;
    }
}

function findNodesConnected_From(node_id_selected)
{
	var nodes_connected = [];
    //scorro tutto l'array edge e salvo gli id che hanno "to" == node_id_selected
    var values = $.map(edges, function(v) { return v; });
    for(var v=0; v<values[2]; v++)
    {
    	var c = array_keys_edges[v];
    	var dict = (values[1][c]);
    	var from_i = dict.from;
    	var to_i = dict.to;
    	if(from_i === node_id_selected[0].toString()){
    		nodes_connected.push(to_i);
    	}
    }
    return nodes_connected;
}

function findNodesConnected_To(node_id_selected)
{
	var nodes_connected = [];
    //scorro tutto l'array edge e salvo gli id che hanno "to" == node_id_selected
    var values = $.map(edges, function(v) { return v; });
    console.log(edges);
    for(var v=0; v<values[2]; v++)
    {
    	var c = array_keys_edges[v];
    	var dict = (values[1][c]);
    	var to_i = dict.to;
    	var from_i = dict.from;
    	var elem = node_id_selected[0].toString();
    	if(to_i === elem){
    		nodes_connected.push(from_i);
    	}
    }
    return nodes_connected;
}

