# Belief Propagation Step by Step
This web application performs belief propagation over Bayesian networks. Its purpose is to
illustrate belief propagation step by step: inference can be peformed incrementally so that
the user can investigate the content of messages and the values of marginals during execution.


## Intallation
It requires the following NodeJS packages:
- `browserify`
- `elementtree`
- `nd4js`
- `xml-formatter`

to be installed with `npm install -g <package>`.

Run 
```
make
```
Then simply open `index.html` in a browser.

The manual is available at https://friguzzi.github.io/belief-propagation/
