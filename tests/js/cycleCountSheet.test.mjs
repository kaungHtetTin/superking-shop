import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../resources/js/Utils/cycleCountSheet.js', import.meta.url), 'utf8');
const { pasteCycleCountCells, cycleCountEditsChanged, cycleCountProgress } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rows = () => [{id:1,counted_quantity:'',notes:''},{id:2,counted_quantity:'9',notes:'Existing note'},{id:3,counted_quantity:'',notes:''}];

test('Excel counts and optional notes map to the selected rows without changing IDs', () => {
    const result = pasteCycleCountCells(rows(), 0, 'counted_quantity', '1,234.5\tShelf A\r\n0\tShelf B\r\n');
    assert.deepEqual(result.slice(0, 2), [{id:1,counted_quantity:'1234.5',notes:'Shelf A'},{id:2,counted_quantity:'0',notes:'Shelf B'}]);
    assert.equal(result[2].counted_quantity,'');
});
test('single-column counts preserve notes and blank cells remain uncounted', () => {
    const result = pasteCycleCountCells(rows(), 0, 'counted_quantity', '1.2345\n\n0\n');
    assert.deepEqual(result.map(row=>row.counted_quantity), ['1.2345','','0']);
    assert.equal(result[1].notes,'Existing note');
});
test('notes can be pasted down a column without modifying counts', () => {
    const result = pasteCycleCountCells(rows(), 1, 'notes', 'Verified\nRecounted\n');
    assert.equal(result[1].counted_quantity,'9');
    assert.deepEqual(result.map(row=>row.notes), ['', 'Verified', 'Recounted']);
});
test('invalid numbers reject the entire paste without mutating the original rows', () => {
    for (const invalid of ['-1','1.23456','1e4','NaN','1,23','10000000000','=1+2']) {
        const original = rows();
        assert.throws(()=>pasteCycleCountCells(original,0,'counted_quantity',`5\n${invalid}`));
        assert.deepEqual(original,rows());
    }
});
test('oversized ranges, extra columns and long notes are rejected', () => {
    assert.throws(()=>pasteCycleCountCells(rows(),2,'counted_quantity','1\n2'));
    assert.throws(()=>pasteCycleCountCells(rows(),0,'counted_quantity','1\tNote\tExtra'));
    assert.throws(()=>pasteCycleCountCells(rows(),0,'notes','a\tb'));
    assert.throws(()=>pasteCycleCountCells(rows(),0,'notes','x'.repeat(1001)));
    assert.throws(()=>pasteCycleCountCells(rows(),0,'system_quantity','10'));
});

test('equivalent numeric formats and trimmed notes do not create unsaved changes', () => {
    const saved = { revision:1, notes:'Weekly count', items:[{id:1,counted_quantity:'8.0000',notes:'Shelf A'},{id:2,counted_quantity:null,notes:null}] };
    const current = { revision:1, notes:' Weekly count ', items:[{id:2,counted_quantity:'',notes:''},{id:1,counted_quantity:'8',notes:'Shelf A '}] };
    assert.equal(cycleCountEditsChanged(saved,current), false);
    current.items[1].counted_quantity='9';
    assert.equal(cycleCountEditsChanged(saved,current), true);
    current.items[1].counted_quantity='8';
    current.items[0].counted_quantity='0';
    assert.equal(cycleCountEditsChanged(saved,current), true);
});
test('posting readiness treats zero as counted and rejects missing or invalid counts', () => {
    assert.deepEqual(cycleCountProgress([{counted_quantity:'0'}, {counted_quantity:'8.0000'}]), {missing:0,invalid:0,complete:true});
    assert.deepEqual(cycleCountProgress([{counted_quantity:''}, {counted_quantity:null}]), {missing:2,invalid:0,complete:false});
    assert.deepEqual(cycleCountProgress([{counted_quantity:'-1'}, {counted_quantity:'1.23456'}]), {missing:0,invalid:2,complete:false});
    assert.equal(cycleCountProgress([]).complete, false);
});
