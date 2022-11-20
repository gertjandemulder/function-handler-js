import {namespaces,prefixes} from "./prefixes";
import {expect} from "chai";
import * as $rdf from 'rdflib';

describe('Namespaces', () => {
    it('Are correctly created for every defined prefix', () => {
        expect(Object.keys(namespaces)).to.have.length(Object.keys(prefixes).length);

        Object.entries(namespaces)
            .forEach(([p,nso])=>{
                expect(nso('').value)
                    .to.equal($rdf.sym(prefixes[p]).value)
            })
    })

    it('Correctly creates a NamedNode for a given string', () => {
        const pref = 'rdf'
        const attr = 'type'
        expect(namespaces[pref](attr).value)
            .to.equal($rdf.sym(`${prefixes.rdf}${attr}`).value);
    })
})
