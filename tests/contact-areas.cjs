const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

let selectedArea = 'PI';
let hookIndex = 0;
const context = vm.createContext({
    window: {}, bookmarkData: [],
    React: {
        useState: () => [[ 'NE', selectedArea, '' ][hookIndex++], () => {}],
        useEffect: () => {},
        createElement: (type, props, ...children) => ({ type, props, children: children.flat(Infinity) })
    }
});
for (const file of ['config.js', 'utils.js', 'components.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const evaluate = source => vm.runInContext(source, context);
for (const value of ['PI | RN | PE | CE', 'PI/RN/PE/CE', ' PI ; RN, PE | CE ']) {
    context.value = value;
    assert.equal(evaluate('JSON.stringify(getContactAreas(value))'), '["PI","RN","PE","CE"]');
}
assert.equal(evaluate('contactHasArea({area: "NOR 10"}, "NOR 1")'), false);
assert.equal(evaluate('JSON.stringify(getContactAreas("CE| ce | CE"))'), '["CE"]');
assert.equal(evaluate('getContactAreas(null).length'), 0);
assert.equal(evaluate('isAlwaysVisibleContact("BA", {area: "BA/SE"})'), true);

const contacts = [
    ...['PI', 'RN', 'PE', 'CE', 'AL', 'PB'].map(area => ({ area, nome: area, topologia: 'GPON' })),
    { area: 'PI | RN | PE | CE', nome: 'Claudio Martins', topologia: 'HFC FO/GPON' },
    { area: 'AL/PB', nome: 'Compartilhado', topologia: 'GPON' },
    { area: 'NE', nome: 'Regional', topologia: 'GPON' }
];
context.store = { sheets: { NE: contacts } };
function nodes(tree) {
    return tree && typeof tree === 'object'
        ? [tree, ...(tree.children || []).flatMap(nodes)] : [];
}
for (selectedArea of ['PI', 'RN', 'PE', 'CE', 'AL', 'PB']) {
    hookIndex = 0;
    const tree = evaluate('ContactsPage({user:{role:"user"},contactStore:store})');
    const elements = nodes(tree);
    const tabs = elements.filter(n => n.type === 'button' && n.props?.className?.includes('contact-file-tab')).map(n => n.children[0]);
    assert.deepEqual(tabs, ['PI', 'RN', 'PE', 'CE', 'AL', 'PB']);
    const cells = elements.filter(n => n.type === 'td').flatMap(n => n.children);
    assert.equal(cells.includes('Claudio Martins'), ['PI', 'RN', 'PE', 'CE'].includes(selectedArea));
    assert.equal(cells.includes('Compartilhado'), ['AL', 'PB'].includes(selectedArea));
    assert.ok(cells.includes('Regional'));
}
console.log('OK: abas individuais, filtros por área, separadores e contatos regionais.');
