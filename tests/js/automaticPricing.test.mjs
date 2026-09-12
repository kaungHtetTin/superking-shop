import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../resources/js/Utils/automaticPricing.js', import.meta.url), 'utf8');
const { automaticPrice, effectiveBuyingCost, purchaseBuyingCost, isBelowBuyingCost } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('preview matches server formula examples exactly', () => {
    for (const [cost, markup, profit, rounding, expected] of [['950',20,100,50,'1150.00'],['1000',10,300,100,'1300.00'],['1000',20,0,100,'1200.00'],['1050',0,0,100,'1100.00'],['0.1',0,0,1,'1.00']]) {
        assert.equal(automaticPrice(cost, { markup_percent:markup, minimum_profit:profit, rounding }), expected);
    }
});
test('invalid or zero cost does not fabricate a selling price', () => {
    for (const cost of ['0','', '-1']) assert.equal(automaticPrice(cost,{markup_percent:20,minimum_profit:0,rounding:1}), null);
});
test('free quantities and unit conversion match six-decimal server costing', () => {
    assert.equal(effectiveBuyingCost('10','2','12','12000'),'833.333333');
    assert.equal(effectiveBuyingCost('10','2','10','100'),'8.333333');
    assert.equal(automaticPrice('1000',{markup_percent:20,minimum_profit:0,rounding:100},12),'14400.00');
});
test('automatic pricing purchase cost excludes FOC and converts to the base unit', () => {
    assert.equal(purchaseBuyingCost('10', '442000'), '44200.000000');
    assert.equal(purchaseBuyingCost('1', '44200'), '44200.000000');
});
test('only positive manual amounts below latest purchase unit cost warn', () => {
    assert.equal(isBelowBuyingCost('99.99','10','10'),true);
    assert.equal(isBelowBuyingCost('100','10','10'),false);
    assert.equal(isBelowBuyingCost('0','10','10'),false);
});
