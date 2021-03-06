.. bp documentation master file, created by
   sphinx-quickstart on Thu May 30 15:47:04 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

===============================
Belief Propagation Step by Step
===============================

.. toctree::
	:maxdepth: 2


Introduction
============
This web application performs belief propagation over Bayesian networks. Its purpose is to
illustrate belief propagation step by step: inference can be peformed incrementally so that
the user can investigate the content of messages and the values of marginals during execution.

In particular, the user can compute just the next message to be exchanged or perform a full round, 
i.e., the update of all messages in the network, or run propagation until convergence.
If the network is a polytree, after two rounds of propagation the algorithm converges.
Otherwise, the propagation algorithm becomes loopy and there is no guarantee of convergence,
even if in practice it often converges.
The application performs one round by cycling over all nodes and computing the outgoing messages.


With this application the user can design a new Bayesian network, load it from an XMLBIF file,
or load a example network. In order to perform propagation, the network is first converted to
a factor graph since belief propagation is simpler on factor graphs.

The source code is available at `<https://github.com/friguzzi/belief-propagation>`_.

For a treatment of the Belief Propagation algorithm you can look at
 - `Barber, D. Bayesian Reasoning and Machine Learning, Cambridge University Press, 2012, page 88. <http://web4.cs.ucl.ac.uk/staff/D.Barber/pmwiki/pmwiki.php?n=Brml.HomePage>`_
 - Koller, Daphne, and Nir Friedman. Probabilistic graphical models: principles and techniques. MIT press, 2009.
 - `Pearl, Judea. Reverend Bayes on inference engines: A distributed hierarchical approach, AAAI 1982. <https://www.aaai.org/Papers/AAAI/1982/AAAI82-032.pdf>`_


Bayesian Network Building
-------------------------

.. image:: network-creation.gif

Inference One Message at a Time
-------------------------------

.. image:: step-one-message.gif

Inference One Round at a Time
-----------------------------

.. image:: step-one-round.gif

Loopy Belief Propagation
------------------------

.. image:: loopy-belief-prop.gif

Support
-------

Send email to fabrizio.riguzzi@unife.it

Copyright by `Fabrizio Riguzzi
<http://ml.unife.it/fabrizio-riguzzi/>`_, `Mirko Covizzi
<https://github.com/MirkoCovizzi>`_ e Alan Guerzi.