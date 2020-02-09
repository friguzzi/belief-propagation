import numpy as np


class Node:
    def __init__(self, name):
        self.connections = []
        self.imbox = {}
        self.name = name

    def append(self, to_node):
        self.connections.append(to_node)
        to_node.connections.append(self)

    def propagate(self, step_n, mu):
        if self.imbox.get(step_n):
            self.imbox[step_n].append(mu)
        else:
            self.imbox[step_n] = [mu]


class Variable(Node):
    def __init__(self, name, size):
        self.bfmarginal = None
        self.size = size
        Node.__init__(self, name)

    def marginal(self):
        if len(self.imbox):
            mus = self.imbox[max(self.imbox.keys())]
            log_values = [np.log(mu.val) for mu in mus]
            valid_log_values = [np.nan_to_num(lv) for lv in log_values]
            sum_logs = sum(valid_log_values)
            valid_sum_logs = sum_logs - max(sum_logs)
            prod = np.exp(valid_sum_logs)
            return prod / sum(prod)
        else:
            return np.ones(self.size) / self.size

    def create_message(self, recipient):
        if not len(self.connections) == 1:
            unfiltered_mus = self.imbox[max(self.imbox.keys())]
            mus = [mu for mu in unfiltered_mus
                   if not mu.from_node == recipient]
            log_values = [np.log(mu.val) for mu in mus]
            return np.exp(sum(log_values))
        else:
            return np.ones(self.size)


class Factor(Node):

    def __init__(self, name, potentials):
        self.p = potentials
        Node.__init__(self, name)

    def create_message(self, recipient):
        if not len(self.connections) == 1:
            unfiltered_mus = self.imbox[max(self.imbox.keys())]
            mus = [mu for mu in unfiltered_mus
                   if not mu.from_node == recipient]
            all_mus = [self.reformat_mu(mu) for mu in mus]
            lanbdas = np.array([np.log(mu) for mu in all_mus])
            max_lanbdas = np.nan_to_num(lanbdas.flatten())
            max_lanbda = max(max_lanbdas)
            result = sum(lanbdas) - max_lanbda
            product_output = np.multiply(self.p, np.exp(result))
            return np.exp(
                np.log(self.summation(product_output, recipient)) + max_lanbda)
        else:
            return self.summation(self.p, recipient)

    def reformat_mu(self, mu):
        dims = self.p.shape
        states = mu.val
        which_dim = self.connections.index(mu.from_node)
        assert dims[which_dim] is len(states)

        acc = np.ones(dims)
        for coord in np.ndindex(dims):
            i = coord[which_dim]
            acc[coord] *= states[i]
        return acc

    def summation(self, p, node):
        dims = p.shape
        which_dim = self.connections.index(node)
        out = np.zeros(node.size)
        assert dims[which_dim] is node.size
        for coord in np.ndindex(dims):
            i = coord[which_dim]
            out[i] += p[coord]
        return out


class Mu:

    def __init__(self, from_node, val):
        self.from_node = from_node
        self.val = val.flatten() / sum(val.flatten())


class FactorGraph:
    def __init__(self, first_node=None, silent=False, debug=False):
        self.nodes = {}
        self.silent = silent
        self.debug = debug
        if first_node:
            self.nodes[first_node.name] = first_node

    def add(self, node):
        assert node not in self.nodes
        self.nodes[node.name] = node

    def connect(self, name1, name2):
        self.nodes[name1].append(self.nodes[name2])

    def append(self, from_node_name, to_node):
        assert from_node_name in self.nodes
        tnn = to_node.name
        if not (self.nodes.get(tnn, 0)):
            self.nodes[tnn] = to_node
        self.nodes[from_node_name].append(self.nodes[tnn])
        return self

    def leaf_nodes(self):
        return [node for node in self.nodes.values()
                if len(node.connections) == 1]

    def observe(self, name, state):
        node = self.nodes[name]
        assert isinstance(node, Variable)
        assert node.size >= state
        for factor in [c for c in node.connections if isinstance(c, Factor)]:
            delete_axis = factor.connections.index(node)
            delete_dims = list(range(node.size))
            delete_dims.pop(state - 1)
            sliced = np.delete(factor.p, delete_dims, delete_axis)
            factor.p = np.squeeze(sliced)
            factor.connections.remove(node)
            assert len(factor.p.shape) is len(factor.connections)
        node.connections = []

    def export_marginals(self):
        return dict([
            (n.name, n.marginal()) for n in self.nodes.values()
            if isinstance(n, Variable)
        ])

    @staticmethod
    def compare_marginals(m1, m2):
        assert not len(np.setdiff1d(m1.keys(), m2.keys()))
        return sum([sum(np.absolute(m1[k] - m2[k])) for k in m1.keys()])

    def compute_marginals(self, max_iter=500, tolerance=1e-6, error_fun=None):
        epsilons = [1]
        step = 0
        for node in self.nodes.values():
            node.imbox.clear()
        cur_marginals = self.export_marginals()
        for node in self.nodes.values():
            if isinstance(node, Variable):
                message = Mu(node, np.ones(node.size))
                for recipient in node.connections:
                    recipient.propagate(step, message)

        while (step < max_iter) and tolerance < epsilons[-1]:
            last_marginals = cur_marginals
            step += 1
            if not self.silent:
                epsilon = 'epsilon: ' + str(epsilons[-1])
                print(epsilon + ' | ' + str(step) + '-' * 20)
            factors = [n for n in self.nodes.values() if isinstance(n, Factor)]
            variables = [n for n in self.nodes.values()
                         if isinstance(n, Variable)]
            senders = factors + variables
            for sender in senders:
                next_recipients = sender.connections
                for recipient in next_recipients:
                    if self.debug:
                        print(sender.name + ' -> ' + recipient.name)
                    val = sender.create_message(recipient)
                    message = Mu(sender, val)
                    recipient.propagate(step, message)
            cur_marginals = self.export_marginals()
            if error_fun:
                epsilons.append(error_fun(cur_marginals, last_marginals))
            else:
                epsilons.append(
                    self.compare_marginals(cur_marginals, last_marginals))
        if not self.silent:
            print('X' * 50)
            print('final epsilon after ' + str(step) + ' iterations = ' + str(
                epsilons[-1]))
        return epsilons[1:]

    def brute_force(self):
        variables = [v for v in self.nodes.values() if isinstance(v, Variable)]

        var_dims = [v.size for v in variables]
        N = len(var_dims)
        log_joint_acc = np.zeros(var_dims)
        for factor in [f for f in self.nodes.values()
                       if isinstance(f, Factor)]:
            which_dims = [variables.index(v) for v in factor.connections]
            factor_acc = np.ones(var_dims)
            for joint_coord in np.ndindex(tuple(var_dims)):
                factor_coord = tuple([joint_coord[i] for i in which_dims])
                factor_acc[joint_coord] *= factor.p[factor_coord]
            log_joint_acc += np.log(factor_acc)
        log_joint_acc -= np.max(log_joint_acc)
        joint_acc = np.exp(log_joint_acc) / np.sum(np.exp(log_joint_acc))
        for i, variable in enumerate(variables):
            sum_dims = [j for j in range(N) if not j == i]
            sum_dims.sort(reverse=True)
            collapsing_marginal = joint_acc
            for j in sum_dims:
                collapsing_marginal = collapsing_marginal.sum(j)
            variable.bfmarginal = collapsing_marginal
        return variables
