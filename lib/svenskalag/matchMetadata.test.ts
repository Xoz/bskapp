import {describe,it,expect} from 'vitest';
import {classifyMatch,readMatchMetadata,validMatchMetadata} from './matchMetadata';
describe('matchtyp från tävling och explicit spelform',()=>{
  it('identifierar verifierade Sanktan-grupper för Gul och Grön',()=>{
    for(const id of ['383770','383772','384047','384048','384049']) expect(classifyMatch(id,'F2014- 2')).toMatchObject({scope:'supported',matchType:'seriespel',format:7,formatSource:'default'});
  });
  it('läser träningsmatcher och 9v9 från tävling eller beskrivning',()=>{
    expect(classifyMatch('400955','Träningsmatcher 9v9')).toMatchObject({matchType:'traningsmatch',format:9,formatSource:'explicit'});
    expect(classifyMatch('375660','Träningsmatcher','Vi spelar 9 mot 9')).toMatchObject({format:9});
    expect(classifyMatch('375660','Träningsmatcher')).toMatchObject({format:7,formatSource:'default'});
  });
  it('gissar inte om cuper, okända tävlingar eller motsägande spelform',()=>{
    expect(classifyMatch('393366','Stockholm Football Cup (Friendly 1)').scope).toBe('cup');
    expect(classifyMatch(null,'').scope).toBe('unknown');
    expect(classifyMatch('999','F2014- 2').scope).toBe('unknown');
    expect(classifyMatch('400955','Träningsmatcher 9v9','7v7').scope).toBe('unknown');
  });
  it('validerar lagrad metadata utan att acceptera ogiltig spelform',()=>{
    const m=classifyMatch('400955','Träningsmatcher 9v9');
    expect(readMatchMetadata(JSON.stringify(m))).toEqual(m);
    expect(validMatchMetadata({...m,format:11})).toBe(false);
    expect(readMatchMetadata('{')).toBeNull();
  });
});
