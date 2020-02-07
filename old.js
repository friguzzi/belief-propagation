function createDynamicProbabilityTable(node_id_selected)
{
    //mi serve sapere quanti domini possiede il nodo selezionato
    var len_domain_node_selected = getDomainFromId(node_id_selected).toString().split(',').length;
    //adesso invece mi servono i nodi collegati
    var allDomain = getAllDomainConnectedToId(node_id_selected);
    //righe e colonne dinamiche per creare la tabella
    var row_table = 1;
    var column_table = len_domain_node_selected + allDomain.length;

    //è indipendente
    if(allDomain.length !== 0)
    {
        //devo sapere quanti elementi ci sono nei vari domini (ovvero quanti sono i domini)
        for(var i=0; i<allDomain.length; i++)
        {
        	var elem_i = allDomain[i].toString().split(',').length;
        	row_table *= elem_i;
        }
    }

    //console.log('row->',row_table);
    //console.log('column->',column_table);

    var nodes_connected = findNodesConnected_To(node_id_selected);

    //CREAZIONE DINAMICA DELLA TABELLA

    var table = $("<table id='dynamic_table' class='table table-hover mt-3'>");

    $("#div_probability_table").append(table);

    ///
    /// Table head (column)
    ///

    var row_table_head=row_table;
    var column_table_head=column_table;

    //parte dinamica
    let html;
    html = "<thead id='thead'><tr class='table-primary text-center'>";

    var el = parseInt(node_id_selected[0].toString());
    var my_domain = getDomainFromId(node_id_selected).toString().split(',');

    //E' INDIPENDENTE
    if(indip[0].includes(el) === true)
    {
        //solo i suoi domini
        for(var j=0; j<my_domain.length; j++)
        {
        	var str = getLabelFromId(id_selected) + " ("+my_domain[j]+")";
        	html = html + "<th><strong>" + str + "</strong></th>";
        }
        html = html + "<th><strong></strong></th>";
    }
    else
    {
        //NON E' INDIPENDENTE
        var only_to = findNodesConnected_From(node_id_selected);
        var array_column = [];

        if(only_to.length === 0)
        {
            //ha solo archi entranti
            for(var j=0; j<nodes_connected.length; j++)
            {
            	array_column.push(nodes_connected[j]);
            	var str = getLabelFromId(nodes_connected[j]);
            	html = html + "<th><strong>" + str + "</strong></th>";
            	flag=1;
            }
            //i miei domini
            for(var j=0; j<my_domain.length; j++)
            {
            	array_column.push(node_id_selected[0].toString());
            	var str = getLabelFromId(node_id_selected) + " ("+my_domain[j]+")";;
            	html = html + "<th><strong>" + str + "</strong></th>";
            	flag=1;
            }
            html = html + "<th><strong></strong></th>";
        }
        else
        {
            //ha sia archi entranti che uscenti
            var flag = 0;
            var index = 0;
            for (var columnCount = 0; columnCount <= column_table_head; columnCount++)
            {
            	if(flag === 0)
            	{
            		for(var j=0; j<nodes_connected.length; j++)
            		{
            			array_column.push(nodes_connected[j]);
            			column_table_head--;
            			var str = getLabelFromId(nodes_connected[j]);
            			html = html + "<th><strong>" + str + "</strong></th>";
            			flag=1;
            		}
            	}
            	else
            	{
            		array_column.push(node_id_selected[0].toString());
            		var str = getLabelFromId(node_id_selected) + " ("+my_domain.toString().split(',')[index]+")";;
            		html = html + "<th><strong>" + str + "</strong></th>";
            		index++;
            	}
            }
            html = html + "<th><strong></strong></th>";
        }
    }

    html = html + "</tr></thead>";
    table.append($(html));

    ///
    /// Table body (row)
    ///

    var row_table_body=row_table;
    var column_table_body=column_table;

    //tutte le combinazioni dei domini presi a k gruppi
    var array_domain=[];
    //ho un solo nodo, quindi un solo dominio!
    if(allDomain.length === 1 || allDomain.length === 0)
    	var num_of_nodes = 1;
    else
    	var num_of_nodes = allDomain.toString().split(',').length;

    var count_nodes = num_of_nodes;

    //mi salva tutti i domini a prescindere da indip che dip
    var combinations_domain = [];

    if(count_nodes === 1)
    {
        //nodo indip
        if(indip[0].includes(node_id_selected[0]) === true)
        {
            //nodo indip
            var domain_selected = getDomainFromId(node_id_selected).toString().split(',');

            for(var j=0; j<domain_selected.length; j++)
            {
            	combinations_domain.push(domain_selected[j]);
            }
        }
        else
        {
            //nodo che entra e che esce (misto)
            var node_from = nodes_connected[0].toString();
            var domain_selected = getDomainFromId(node_from).toString().split(',');
            combinations_domain = domain_selected;
        }
    }
    else
    {
    	for(var i=0; i< count_nodes; i++)
    	{
    		var elem = allDomain[i];
    		var count = elem.toString().split(',').length;
    		var single_domain = elem.toString().split(',');
    		for(var j=0; j< count; j++)
    		{
    			array_domain.push(single_domain[j]);
    		}
    		count_nodes -= count;
    		i=0;
    	}

    	var k_group = allDomain.length;
    	var combs = combinations(array_domain,k_group);
    	console.log("array_domain", array_domain);
    	console.log("k_group", k_group);

        //elimino le doppie
        var hashMap = {};

        combs.forEach(function(arr){
        	hashMap[arr.join("|")] = arr;
        });

        combinations_domain = Object.keys(hashMap).map(function(k){
        	return hashMap[k];
        });
    }

    //se sono indipendenti, ho una sola riga!
    if(row_table_body === 1)
    {
    	html = "<tr class='table-dark text-center'>";
    	for (var fieldCount = 0; fieldCount < column_table_body; fieldCount++) {
    		if(fieldCount > 1)
    			var str = "<input style='text-align: center' value=0.0>";
    		else
    			var str = "<input style='text-align: center' value=0.5>";
    		html = html + "<td>" + str + "</td>";
    	}
    	html = html +"<td><button id='check_value' type='button' class='btn btn-success'>✓</button></td></tr>";
    	table.append($(html));
    }
    else
    {
    	for (var rowCount = 0; rowCount < row_table_body; rowCount++)
    	{
    		html = "<tr class='table-dark text-center'>";

    		for (var fieldCount = 0; fieldCount < column_table_body; fieldCount++) {
    			if(array_column[fieldCount].toString() === node_id_selected.toString())
    			{
    			    console.log(fieldCount, array_column[fieldCount], node_id_selected);
    				var str = "<input style='text-align: center' value=0.5>";
    				html = html + "<td>" + str + "</td>";
    			}
    			else
    			{
    				var str = combinations_domain[rowCount][fieldCount];
    				html = html + "<td>" + str + "</td>";
    			}
    		}
    		html = html +"<td><button id='check_value' type='button' class='btn btn-success'>✓</button></td></tr>";
    		table.append($(html));
    	}
    }
}

function combinations(arr, size)
{
	var len = arr.length;

	if (size > len) return [];
	if (!size) return [[]];
	if (size === len) return [arr];

	return arr.reduce(function (acc, val, i) {
		var res = combinations(arr.slice(i + 1), size - 1)
		.map(function (comb) { return [val].concat(comb); });

		return acc.concat(res);
	}, []);
}

//mi serve per mostrare l'help
var help_flag=0;

$("#help").click(function()
{
    //per ogni voce del menu ho un help diverso ovviamente
    var option_selected = $("#name_choice").text();
    if(help_flag===0 && option_selected === "Create Node")
    {
    	$("#help_message").html("1) assign <strong>Name</strong> to the node </br> 2) assign <strong>Domain</strong> to the node </br> 3) click <strong>Create!</strong></br></br><strong>TIPS</strong> if name starts with 'A' 🡲 create alphabetical order </br>&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;else 🡲 create numerical order");
    	$("#help_message").show();
    	help_flag=1;
    }
    else if(help_flag===0 && option_selected === "Create Arc")
    {
    	$("#help_message").html("1) click it the <strong>first node</strong> (from) </br> 2) click it the <strong>second node</strong> (to) </br></br> (click outside for deselect your chioce)");
    	$("#help_message").show();
    	help_flag=1;
    }
    else if(help_flag===0 && option_selected === "Delete Node")
    {
    	$("#help_message").html("Click into the <strong>node to be destroyed</strong>");
    	$("#help_message").show();
    	help_flag=1;
    }
    else if(help_flag===0 && option_selected === "Delete Arc")
    {
    	$("#help_message").html("1) click it the <strong>first node</strong> (from) </br> 2) click it the <strong>second node</strong> (to) </br></br> (click outside for deselect your chioce)");
    	$("#help_message").show();
    	help_flag=1;
    }
    else if(help_flag===0 && option_selected === "Set Properties")
    {
    	$("#help_message").html("1) select <strong>node to modify </strong></br> 2) change his value: <strong>name</strong> or <strong>domain</strong></br> 3) click to Change!");
    	$("#help_message").show();
    	help_flag=1;
    }
    else if(help_flag===0 && option_selected === "Probability Table")
    {
    	$("#help_message").html("1) Click into the <strong>node</strong></br> 2) <strong>compile</strong> his probability table</br> 3) <strong>check</strong> the insert value and <strong>save</strong> the row");
    	$("#help_message").show();
    	help_flag=1;
    }
    else
    {
    	$("#help_message").hide();
    	help_flag=0;
    }
});