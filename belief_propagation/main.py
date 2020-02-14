from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin

import numpy as np

from xml.etree.ElementTree import Element, SubElement, tostring

from logic import Variable, Factor, FactorGraph

app = Flask(__name__)
CORS(app, support_credentials=True)


def generate_xml(nodes):
    '''
    This function takes the nodes dictionary as input and generates a valid XMLBIF file from it.
    Then returns it, which is sent to the client front-end.
    '''
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
    for node in nodes:
        variable = SubElement(network, "VARIABLE")
        variable.set("TYPE", "nature")
        name = SubElement(variable, "NAME")
        name.text = nodes[node]['label']
        domain = nodes[node]['domain']
        for d in domain:
            outcome = SubElement(variable, "OUTCOME")
            outcome.text = d
        property = SubElement(variable, "PROPERTY")
        property.text = "position = (0.0, 0.0)"
        definition = SubElement(network, "DEFINITION")
        def_for = SubElement(definition, "FOR")
        def_for.text = nodes[node]['label']
        given = nodes[node]['probability']['given']
        table = nodes[node]['probability']['table']
        table = [str(p) for p in table]
        for g in given:
            def_given = SubElement(definition, "GIVEN")
            def_given.text = nodes[g]['label']
        def_table = SubElement(definition, "TABLE")
        def_table.text = " ".join(table)
    return (b'<?xml version="1.0" encoding="UTF-8"?>' + tostring(bif)).decode('utf-8')


def build_graph(nodes):
    '''
    This function, given the nodes dictionary, builds the graph (or network) corresponding, by using the utility
    classes of the belief propagation model.
    It returns the finished graph.
    '''
    factors = {}
    single_factors = {}
    g = FactorGraph()
    for node in nodes:
        node_name = 'x_' + node
        node_domain = nodes[node]['domain']
        node_given = nodes[node]['probability']['given']
        node_variable = Variable(node_name, len(node_domain))
        g.add(node_variable)
        if len(node_given) > 0:
            factor_name = 'f_' + node + '_' + '_'.join(node_given)
            probability_table = nodes[node]['probability']['table']
            probability_table = [float(f) for f in probability_table]
            probabilities = np.array(probability_table)
            shape = []
            for n in node_given:
                n_domain = nodes[n]['domain']
                shape.append(len(n_domain))
            shape.append(len(node_domain))
            probabilities = probabilities.reshape(shape)
            factor = Factor(factor_name, probabilities)
            first_name = 'x_' + node_given[0]
            middle_names = []
            node_given.pop(0)
            for n in node_given:
                middle_names.append('x_' + n)
            factors[factor_name] = {'first': first_name, 'middle': middle_names, 'last': node_name}
            g.add(factor)
        elif len(node_given) == 0:
            factor_name = 'f_' + node
            probability_table = nodes[node]['probability']['table']
            probability_table = [float(f) for f in probability_table]
            probabilities = np.array(probability_table)
            factor = Factor(factor_name, probabilities)
            single_factors[node_name] = factor_name
            g.add(factor)
    for factor in factors:
        first_name = factors[factor]['first']
        middle_names = factors[factor]['middle']
        last = factors[factor]['last']
        g.connect(first_name, factor)
        for m in middle_names:
            g.connect(factor, m)
        g.connect(factor, last)
    for node_name in single_factors:
        g.connect(node_name, single_factors[node_name])
    return g


def observe(graph, observations):
    observations = {key: int(observations[key]) for key in observations if int(observations[key]) >= 0}
    for o in observations:
        graph.set_evidence('x_' + o, observations[o] + 1)


@app.route('/belief_propagation', methods=['POST'])
@cross_origin(supports_credentials=True)
def belief_propagation():
    '''
    At the address "belief_propagation", the POST value gets parsed and used to generate a valid network that then
    gets used to calculate marginals.
    The returned values are the marginals of the node specified in the query.
    '''
    data = request.json
    nodes = data['nodes']
    query_node = 'x_' + str(data['query_node'])
    observations = data['observations']
    generate_xml(nodes)
    g = build_graph(nodes)
    observe(g, observations)
    g.calculate_marginals()
    result = g.nodes[query_node].marginal()
    return jsonify(str(result))


@app.route('/save_network', methods=['POST'])
@cross_origin(supports_credentials=True)
def save_network():
    '''
    At the address "save_network", the POST value (the nodes dictionary object) gets parsed and used to generate
    a valid XMLBIF file.
    The returned value is the XMLBIF file, stringified and jsonified.
    '''
    data = request.json
    nodes = data['nodes']
    xml = generate_xml(nodes)
    return jsonify({"xml": str(xml)})


if __name__ == '__main__':
    app.run()
