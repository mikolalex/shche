var $ = require('jquery');
var assert = require('assert');
var che_parser = require('ooo_oo_o');
var che = require('../shche');
		
var id = a => a;
var always = (a) => {
	return () => a;
}
//*
describe('Che', function () {
	it('Testing che 1', function(){
		var res = 0;
		var obj = che.create('> (|(> b, c),(> e, f)):zzz, d:aaa', {
			onSuccess: function(){
				++res;
			}
		});
		obj.drip("e", 1);
		obj.drip("f", 2);
		obj.drip("d", 3); 
		assert.equal(res, 1);
		assert.equal(obj.state.zzz, 2);
		assert.equal(obj.state.aaa, 3);
	})
	it('Testing che pipes', function(){
		var res = 0;
		var obj = che.create('> a, b|1:ololo, c[res = ololo]', {
			onSuccess: function(){	
				++res;
			}
		}, function(val){
			return val * 2;
		});
		obj.drip("a", 1);
		obj.drip("a", 2);
		obj.drip("a", 3);
		obj.drip("b", 2);
		obj.drip("c", 3);
		assert.deepEqual(obj.state, {a: 1, ololo: 4, c: 3, res: 4});
	})
	it('Testing che quantifiers: * 1', function(){
		var obj = che.create('> a, b*, c', {}, function(state, val){
			state.ololo = val;
			return state;
		}, function(state, val){
			return state.ololo;
		});
		obj.drip("a", 1);
		obj.drip("b", 2);
		obj.drip("b", 3);
		obj.drip("b", 2);
		obj.drip("c", 3);
		obj.drip("b", 2);
		obj.drip("b", 2);
		assert.deepEqual(obj.state, {"a":1,"b":[2,3,2],"c":3});
	})
	it('Testing che quantifiers: * 2', function(){
		var obj = che.create('> a, b*, c', {}, function(state, val){
			state.ololo = val;
			return state;
		}, function(state, val){
			return state.ololo;
		});
		obj.drip("a", 1);
		obj.drip("c", 3);
		assert.deepEqual(obj.state, {"a":1,"c":3});
		//assert.deepEqual(obj.state, {a: 1, ololo: 2, c: 3});
	})
	it('Testing che quantifiers: +', function(){
		var obj = che.create('> a, b+, c', {}, 
			function(state, val){
				state.ololo = val;
				return state;
			}, function(state, val){
				return state.ololo;
			}
		);
		obj.drip("a", 1);
		obj.drip("c", 3);
		assert.deepEqual(obj.state, {a: 1});
		//assert.deepEqual(obj.state, {a: 1, ololo: 2, c: 3});
	})
	it('Testing che quantifiers: {,}', function(){
		var obj = che.create('> a, b{2,4}, c', {}, function(state, val){
			state.ololo = val;
			return state;
		}, function(state, val){
			return state.ololo;
		});
		obj.drip("a", 1);
		obj.drip("b", 3);
		obj.drip("c", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("c", 3);
		assert.deepEqual(obj.state, {a: 1, b: [3, 3, 3, 3], c: 3});
	})
	it('Testing che quantifiers: {}', function(){
		var obj = che.create('> a, (| b{2}, c{4}), d', {}, function(state, val){
			state.ololo = val;
			return state;
		}, function(state, val){
			return state.ololo;
		});
		obj.drip("a", 1);
		obj.drip("b", 3);
		obj.drip("c", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("d", 3);
		assert.deepEqual(obj.state, {"a":1,"b":[3,3],"c":[3],"d":3});
	})
	it('Testing conditional events', function(){
		var obj = che.create('> a, b?1|2, c', {}, function(state, val){
			return val > 10;
		}, function(state, val){
			state.b = val;
			return state;
		});
		obj.drip("a", 1);
		obj.drip("b", 3);
		obj.drip("c", 3);
		obj.drip("b", 13);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("b", 3);
		obj.drip("c", 3);
		//console.log(JSON.stringify(obj.state));
		assert.deepEqual(obj.state, {a: 1, b: 13, c: 3});
	})
})

describe('Testing / operator', function () {
	it('1.', function(done){
		var obj = che.create('> a, (/ (wait500()..., b), (wait200()..., c)), d', {}, {
			wait500: function(state, cb){
				setTimeout(() => {
					cb(true);
				}, 500)
			},
			wait200: function(state, cb){
				setTimeout(() => {
					cb(true);
				}, 200)
			},
		});
		obj.drip("a", 1);
		setTimeout(() => {
			obj.drip("d", 1);
			obj.drip("b", 1);
			obj.drip("c", 1);
			obj.drip("d", 2);
			assert.deepEqual(obj.state, {a: 1, c: 1, d: 2});
			assert.equal(obj.finished, true);
			done();
		}, 600);
	})
})

describe('Testing & operator', function () {
	it('Simple positive example', function(){
		var obj = che.create('> a, (& b, d), c');
		obj.drip("a", 1);
		obj.drip("d", 1);
		obj.drip("b", 1);
		obj.drip("c", 1);
		assert.deepEqual(obj.state, {a: 1, b: 1, c: 1, d: 1});
		assert.equal(obj.finished, true);
	})
	it('Simple negative example', function(){
		var obj = che.create('> a, (& b, d), c');
		obj.drip("a", 1);
		obj.drip("d", 1);
		obj.drip("c", 1);
		assert.equal(obj.finished, undefined);
	})
	it('Complex positive example', function(){
		var obj = che.create('> a, (& (> b, v), d), c');
		obj.drip("a", 1);
		obj.drip("b", 1);
		obj.drip("d", 1);
		obj.drip("v", 1);
		obj.drip("c", 1);
		assert.equal(obj.finished, true);
	})
})

describe('Other', function(){
	it('Testing objects as calback', () => {
		var obj = che.create('> a, (& b, d|multiply_10:ololo), c', {}, {
			multiply_10: function(val){
				return val*10;
			}
		});
		obj.drip("a", 1);
		obj.drip("d", 1);
		obj.drip("b", 1);
		obj.drip("c", 1);
		assert.deepEqual(obj.state, {a: 1, ololo: 10, b: 1, c: 1});
	})
	it('Testing sync functions', () => {
		var obj = che.create('> a, (| b, c), check():done, d', {}, {
			check: function(state){
				return state.a > 0;
			},
		});
		obj.drip("a", 1);
		obj.drip("c", 1);
		obj.drip("d", 1);
		assert.equal(obj.state.done, true);
	})
	it('Testing async functions', (done) => {
		var obj = che.create('> str, (| b, c), make_request()...:res, d', {}, {
			make_request: function(state, cb){
				//console.log('making request...');
				setTimeout(() => {
					//console.log('running callback');
					cb(true, 'some_test_data');
				}, 1000)
			},
		});
		obj.drip("str", 'ololo');
		obj.drip("c", 1);
		obj.drip("d", 1);
		setTimeout(()=>{
			assert.equal(obj.state.res, 'some_test_data');
			done();
		}, 1100)
	})
	it('Testing async functions: parralel', (done) => {
		var obj = che.create('> a, (| make_request1()..., make_request2()..., make_request3()...):res{2}, b', {}, {
			make_request1: function(state, cb){
				setTimeout(() => {
					cb(true, 'some_test_data_1');
				}, 100)
			},
			make_request2: function(state, cb){
				setTimeout(() => {
					cb(true, 'some_test_data_2');
				}, 120)
			},
			make_request3: function(state, cb){
				setTimeout(() => {
					cb(true, 'some_test_data_3');
				}, 50)
			},
		});
		obj.drip("a", 42);
		obj.drip("c", 1);
		obj.drip("d", 1);
		setTimeout(() => {
			assert.equal(obj.state.a, 42);
			assert.deepEqual(obj.state.res, ["some_test_data_3","some_test_data_1"]);
			done();
		}, 500);
	})
})

// Calculator
// | .cancel|click//, (> ".num|click|getval"|append(a)*, (".operation|click"|make_operation, ".num|click|getval"|append(b)*)) 


	var str11 = `
			> 
				".select_rect|click"/active_figure/, 
				(".map|click"/points/*), 
				(
					| 
					".save|click"/"rectangles"|1/, 
					".discard|click"
					)/active_figure|false/`;//*/
