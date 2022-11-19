import * as $rdf from 'rdflib';
import {NamedNode} from "rdflib";

export const prefixes = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    ex: "http://www.example.com#",
    dcterms: "http://purl.org/dc/terms/",
    doap: "http://usefulinc.com/ns/doap#",
    fno: "https://w3id.org/function/ontology#",
    fnoi: "https://w3id.org/function/vocabulary/implementation#",
    fnom: "https://w3id.org/function/vocabulary/mapping#",
    fnoc: "https://w3id.org/function/vocabulary/composition#",
    fns: "http://example.com/functions#"
};

export function prefix(...args) {
    return args.join('');
}

export class Namespace {
    private _prefix: string;
    private _iri: string;

    constructor(prefix: string, iri: string) {
        this._prefix = prefix;
        this._iri = iri;
    }

    /**
     * If arg is provided, this function prefixes the given argument with the namespace and returns it as a NamedNode.
     * Otherwise, the namespace is returned as a NamedNode.
     * @param arg
     */
    toNamedNode(arg?: string): NamedNode {
        return $rdf.sym(prefix(this._iri, arg));
    }

    get prefix(): string {
        return this._prefix;
    }

    get iri(): string {
        return this._iri;
    }
}

export const namespaces = Object.fromEntries(Object.entries(prefixes).map(([p,i])=>[p, new Namespace(p,i)]));
