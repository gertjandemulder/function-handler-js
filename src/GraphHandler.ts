import * as $rdf from "rdflib";
import {NamedNode, Namespace} from "rdflib";
import {NamedNode as TFNamedNode} from "rdflib/lib/tf-types";

import ldfetch from "ldfetch";
import {Quad, Term} from "rdf-js";
import {Writer} from "n3";
import {namespaces} from "./prefixes";

var RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")

export type LocalValue = {
    type: "string" | "quads"
    contents: string | Quad[],
    contentType?: string
}

interface ISubFilters<K> {
    s: (v:K) => any[]
    p: (v:K) => any[]
    o: (v:K) => any[]
    sp: (s: K, p: K) => any[]
    po: (p: K, o: K) => any[]
    so: (s: K, o: K) => any[]
    spo: (s: K, p:K, o: K) => any[]
}

export class GraphHandler {
    getSubjectOfType(iri: string, type?: string): Term | null {
        let result = $rdf.sym(iri);
        let q;
        if (type) {
            q = this._graph.match(result, RDF('type'), $rdf.sym(type));
        } else {
            q = this._graph.match(result);
        }
        if (q.length > 0) {
            return q[0].subject as Term;
        }
        return null;
    }

    match(s, p, o) {
        return this._graph.match(s, p, o);
    }

    filter: ISubFilters<TFNamedNode> = {
        s: (v) => this._graph.match(v,null,null),
        p: (v) => this._graph.match(null, v, null),
        o: (v) => this._graph.match(null, null, v),
        sp: (s,p) => this._graph.match(s,p,null),
        so: (s,o) => this._graph.match(s, null, o),
        po: (p, o) => this._graph.match(null, p, o),
        spo: (s,p, o) => this._graph.match(s, p, o),
    }

    isA(s: TFNamedNode, c: TFNamedNode): boolean {
        return this.match(s,namespaces.rdf('type'),c).length > 0;
    }
    get graph(): any {
        return this._graph;
    }

    private _graph: any
    private _graphParts: {
        [iri: string]: LocalValue
    }

    constructor() {
        this._graphParts = {};
        this._graph = this._graph = $rdf.graph();
    }

    async addGraph(iri: string, localValue: LocalValue | null = null) {
        if (!localValue) {
            const fetch = new ldfetch({});
            const triples = (await fetch.get(iri)).triples;
            const writer = new Writer({});
            writer.addQuads(triples);
            const writerPromise = new Promise<string>((resolve, reject) => {
                writer.end((error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });

            localValue = {
                type: "string",
                contents: await writerPromise,
                contentType: "text/turtle"
            }
        }
        this._graphParts[iri] = localValue;

        await this._updateGraph();
    }

    private async _updateGraph() {
        this._graph = $rdf.graph();
        for (const graphPartsKey in this._graphParts) {
            const graphPart = this._graphParts[graphPartsKey];
            if (graphPart.type === "quads") {
                for (const quad of graphPart.contents as Quad[]) {
                    this._graph.add(quad.subject, quad.predicate, $rdf.sym(quad.object.value), quad.graph)
                }
            } else {
                $rdf.parse(graphPart.contents as string, this._graph, graphPartsKey, graphPart.contentType)
            }
        }
    }

}
