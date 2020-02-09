from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin

import numpy as np

from logic import Variable, Factor, FactorGraph

app = Flask(__name__)
CORS(app, support_credentials=True)


def build_graph(nodes):
    factors = {}
    single_factors = {}
    g = FactorGraph(silent=True)
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
        graph.observe('x_' + o, observations[o] + 1)


@app.route('/foo', methods=['POST'])
@cross_origin(supports_credentials=True)
def foo():
    data = request.json
    nodes = data['nodes']
    query_node = 'x_' + str(data['query_node'])
    observations = data['observations']
    g = build_graph(nodes)
    observe(g, observations)
    g.compute_marginals(max_iter=500, tolerance=1e-6)
    result = g.nodes[query_node].marginal()
    return jsonify(str(result))


if __name__ == '__main__':
    app.run()
