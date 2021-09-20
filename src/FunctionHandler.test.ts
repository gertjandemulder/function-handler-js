import { expect } from 'chai';
import { FunctionHandler } from "./FunctionHandler";
import { } from 'mocha';
import { JavaScriptHandler } from './handlers/JavaScriptHandler';
import { Argument, Function, Implementation } from './models';
import { namedNode } from 'rdflib';
import { Term } from 'rdf-js';
import prefixes from './prefixes';

const fnTtl = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://www.example.com#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix doap: <http://usefulinc.com/ns/doap#> .
@prefix fno: <https://w3id.org/function/ontology#> .
@prefix fnoi: <https://w3id.org/function/vocabulary/implementation#> .
@prefix fnom: <https://w3id.org/function/vocabulary/mapping#> .       
@prefix fns: <http://example.com/functions#> .

fns:aParameter rdf:type fno:Parameter ;
        rdfs:label "a"@en ;
        fno:predicate fns:a ;
        fno:required "true"^^xsd:boolean .

fns:bParameter rdf:type fno:Parameter ;
        rdfs:label "b"@en ;
        fno:predicate fns:b ;
        fno:required "true"^^xsd:boolean .

fns:sumOutput rdf:type fno:Output ;
        rdfs:label "sum output"@en ;
        fno:predicate fno:Result .

fns:sum rdf:type fno:Function ;
        dcterms:description "Description of the sum function"@en ;
        rdfs:label "sum"@en ;
        fno:expects _:g0 ;
        fno:returns _:g2 .

_:g0 rdf:first fns:aParameter ;
        rdf:rest _:g1 .

_:g1 rdf:first fns:bParameter ;
        rdf:rest rdf:nil .

_:g2 rdf:first fns:sumOutput ;
        rdf:rest rdf:nil .

fns:sumImplementation rdf:type fno:Implementation, fnoi:JavaScriptImplementation, fnoi:JavaScriptFunction ;
        doap:release fns:sumImplementationRelease .

fns:sumImplementationRelease doap:file-release fns:sumImplementationReleaseFile .

fns:sumImplementationReleaseFile ex:value " function sum(a, b) {   return a + b; } " .

fns:sumMapping rdf:type fno:Mapping ;
        fno:function fns:sum ;
        fno:implementation fns:sumImplementation ;
        fno:parameterMapping fns:aParametermapping, fns:bParametermapping ;
        fno:returnMapping fns:sumReturnMapping ;
        fno:methodMapping fns:sumMethodMapping .

fns:aParametermapping rdf:type fno:ParameterMapping, fnom:PositionParameterMapping ;
        fnom:functionParameter fns:aParameter ;
        fnom:implementationParameterPosition "0"^^xsd:integer .

fns:bParametermapping rdf:type fno:ParameterMapping, fnom:PositionParameterMapping ;
        fnom:functionParameter fns:bParameter ;
        fnom:implementationParameterPosition "1"^^xsd:integer .

fns:sumReturnMapping rdf:type fno:ReturnMapping, fnom:DefaultReturnMapping .

fns:sumMethodMapping rdf:type fno:MethodMapping, fnom:StringMethodMapping ;
        fnom:method-name "sum" .
`;

describe('FunctionHandler tests', () => { // the tests container
        it.skip('can parse a function file', async () => { // the single test
                const handler = new FunctionHandler();
                await handler.addFunctionResource("http://users.ugent.be/~bjdmeest/function/grel.ttl#");

                const fn = await handler.getFunction("http://users.ugent.be/~bjdmeest/function/grel.ttl#array_join");

                expect(fn).to.be.any;
        });

        it('can load a local file, add a handler, and execute a function', async () => {
                const handler = new FunctionHandler();
                await handler.addFunctionResource(`${prefixes.fns}sum`, {
                        type: 'string',
                        contents: fnTtl,
                        contentType: "text/turtle"
                });
                const fn = await handler.getFunction(`${prefixes.fns}sum`);

                expect(fn).to.be.not.null;

                expect(fn.id).to.equal(`${prefixes.fns}sum`)

                const jsHandler = new JavaScriptHandler();
                jsHandler.loadFunction(new Implementation(namedNode(`${prefixes.fns}sumImplementation`) as Term), (a, b) => a + b)

                handler.addHandler(jsHandler);
                const result = await handler.executeFunction(fn, [
                        new Argument(`${prefixes.fns}aParameter`, 1),
                        new Argument(`${prefixes.fns}bParameter`, 1),
                ])

                expect(result).to.equal(2);
                return;
        })
});
