var parserPackage = require('../ooo_oo_o/parser');
var config = require('./config');

var parser = parserPackage.get_parser(config);
var parsed_pool = {};

var get_subscriptions = function(struct, cells_set){
	if(struct.event) struct = struct.event;
	if(!struct.type){
		console.warn('No type', struct);
	}
	switch(struct.type){
		case 'revolver':
			switch(struct.subtype){
				case '|':
					for(var i = 0;i < struct.children.length; i++){
						var child = struct.children[i];
						if(child.event){
							child = child.event;
						}
						get_subscriptions(struct.children[i], cells_set);
					}
				break;
				case '>':
					var child = struct.children[0];
					if(child.event){
						child = child.event;
					}
					get_subscriptions(child, cells_set);
				break;
			}
		break;
		case 'cell':
			cells_set.add(struct.name);
		break;
	}
	return cells_set;
}

var output = function(){

}

function dripres(full_success = false, particular_success = false, value){
	return {full_success, particular_success, value};
}

var is_luck = (a) => {
	return a.full_success;
}
var has_particular_success = (a) => {
	return a.particular_success;
}
var get_value = (a) => {
	return a.value;
}

var is_multiple = (quant) => {
	return !!(quant && (quant.max !== 1));
}

var is_num = (a) => Number(a) == a;

var defaultStateMutator = function(state, key, val){
	if(val !== undefined){
		state[key] = val;
	}
	return state;
}


var Chex = function(struct, linking = {}, callbacks = []){
	this.struct = struct;
	this.onOutput = linking.onOutput;
	this.onSuccess = linking.onSuccess;
	this.stateMutator = linking.stateMutator ? linking.stateMutator : defaultStateMutator;
	this.callbacks = callbacks;
	this.state = {};
	this.mirror = {
		children: [],
	};
	this.refreshSubscriptions();
	this.activate_needed_events();
};

Chex.prototype.getStruct = function(struct){
	return this.struct;
}

Chex.prototype.__runCallback = function(pipe, value){
	var cb;
	if(is_num(pipe)){
		// its number
		--pipe; // because it's 1-based
		cb = this.callbacks[pipe];
	} else {
		cb = this.callbacks[0][pipe];
	}
	if(!(cb instanceof Function)){
		console.error('Callback should be a function!');
		return;
	}
	return cb(value);

}

Chex.prototype.absorb = function(struct, mirror_struct, cellname, value){
	//console.log('checking children', struct.children);
	var res;
	var check = (i) => {
		let child = struct.children[i];
		if(child.event){
			child = child.event;
		}
		switch(child.type){
			case 'cell':
			case 'func':
				if(child.name === cellname){
					var cond = struct.children[i].cond;
					if(cond){
						--cond; // because it's 1-based
						if(!this.callbacks[cond]){
							console.error('No callback for cond:', cond);
						}
						var lakmus = this.callbacks[cond](this.state, value);
						if(!lakmus) return dripres();
					} 
					var state = mirror_struct.children[i];
						state.counter = state.counter ? state.counter + 1 : 1;
					var pipe = struct.children[i].pipe;
					var imp = struct.children[i].imperatives;
					var quant = struct.children[i].quantifier;
					if(quant && quant.max !== undefined && quant.max < state.counter){
						// counter exceeded
						return dripres();
					}
					if(pipe){
						value = this.__runCallback(pipe, value);
					} 
					// regular join
					var real_key = struct.children[i].output 
								? struct.children[i].output
								: cellname;
					var as_array = is_multiple(quant);
					if(as_array){
						if(!this.state[real_key]){
							this.state[real_key] = [];
						}
						this.state[real_key].push(value);
					} else {
						this.stateMutator(this.state, real_key, value);
					}
					if(imp){
						imp.forEach((pair) => {
							var [to, from] = pair;
							this.state[to] = this.state[from];
						})
					}
					if(quant){
						if(state.counter >= quant.min){
							return dripres(true, true, value);
						} else {
							return dripres();
						}
					} 
					return dripres(true, true, value);
				}
			break;
			case 'revolver':
				if(!mirror_struct.children[i]){
					mirror_struct.children[i] = {
						children: [],
						//type: child.subtype,
						//parent: mirror_struct,
					}
				}
				return this.absorb(child, mirror_struct.children[i], cellname, value);
			break;
		}
		return dripres();
	}
	var output = (output, val) => {
		this.onOutput(output, val);
	}
	if(!struct.subtype){
		struct = struct.event;
	}
	var luck_hapenned = false;
	switch(struct.subtype){
		case '|':
			for(let i in struct.children){
				//console.log('checking', struct.children[i]);
				res = check(i);
				if(is_luck(res)){
					if(struct.children[i].output){
						output(struct.children[i].output, get_value(res));
					}
					return dripres(true, true, value);;
				}
			}
		break;
		case '/':
			for(let i in struct.children){
				if(mirror_struct.successful_branch !== undefined && mirror_struct.successful_branch !== i){
					//console.log('now we skip it!', i);
					continue;
				}
				res = check(i);
				if(has_particular_success(res)){
					mirror_struct.successful_branch = i;
				}
				if(is_luck(res)){
					if(struct.children[i].output){
						output(struct.children[i].output, get_value(res));
					}
					return dripres(true, true, value);
				}
				if(mirror_struct.successful_branch === i){
					break;
				}
			}
		break;
		case '&':
			mirror_struct.count_all_counter = mirror_struct.count_all_counter || 0;
			mirror_struct.count_all_each_event = mirror_struct.count_all_each_event || {};
			for(let i in struct.children){
				//console.log('checking', struct.children[i], i, mirror_struct.count_all_counter);
				res = check(i);
				if(is_luck(res)){
					luck_hapenned = true;
					if(struct.children[i].output){
						output(struct.children[i].output, get_value(res));
					}
					if(!mirror_struct.count_all_each_event[i]){
						mirror_struct.count_all_counter++;
						if(mirror_struct.count_all_counter === struct.children.length){
							//console.log('Full success!');
							return dripres(true, true, value);
						}
					}
					mirror_struct.count_all_each_event[i] = true;
				}
			}
		break;
		case '>':
			var pos = mirror_struct.pos || 0;
			for(let i = pos; ; i++){
				if(!struct.children[i]){
					break;
				}
				res = check(i);
				var state = mirror_struct.children[i];
					state.counter = state.counter || 0;
				if(is_luck(res)){
					luck_hapenned = true;
					if(mirror_struct.counter === undefined){
						mirror_struct.counter = 0;
					}
					++mirror_struct.counter;
					if(struct.children[i].output){
						output(struct.children[i].output, get_value(res));
					}
					var next_pos = pos + 1;
					if(!struct.children[next_pos]){
						// revolver finished
						//console.log(struct.children, next_pos, '> REVOLVER SUCCESS!');
						return dripres(true, true, value);;
					} else {
						if(!struct.children[i].quantifier 
								|| mirror_struct.counter > struct.children[i].quantifier.max){
							//console.log(struct.children[i].quantifier, mirror_struct.counter);
							// if it's finite
							pos = i;
							++pos;
							mirror_struct.pos = pos;
						}
					}
				} else {
					if(
							struct.children[i].quantifier 
							&& struct.children[i].quantifier.min !== 0
							&& state.counter < struct.children[i].quantifier.min
					){
						break;
					}
				}
				if(!struct.children[i].quantifier || !is_multiple(struct.children[i].quantifier)){
					//console.log('should break', struct.children[i].quantifier);
					break;
				}
				if(
						struct.children[i].quantifier 
						&& struct.children[i].quantifier.max !== undefined
						&& mirror_struct.counter < struct.children[i].quantifier.max
				){
					//console.log);
					// struct.children[i].quantifier.max < mirror_struct.counter
					//console.log('should break', struct.children[i].quantifier);
					break;
				}
			}
		break;
		default:
			console.log('Unknown revolver type:', struct.subtype);
		break;
	}
	return dripres(false, luck_hapenned);
}

Chex.prototype.refreshSubscriptions = function(){
	var subscr = new Set;
	this.subscriptions = get_subscriptions(this.getStruct(), subscr);
}

Chex.prototype.sleep = function(){
	this.mirror = {
		children: [],
	};
	this.state = {};
	this.sleeping = true;
}

Chex.prototype.awake = function(){
	this.sleeping = false;
}

Chex.prototype.activate_needed_events = function(){
	var cells_and_funcs = this.get_active_cells_and_funcs(null, null, this.struct, this.mirror);
	this.needed_events = cells_and_funcs[0];
	var cb = function(fnc, done, value){
		this.drip(fnc.name, value);
	}
	for(let fnc of cells_and_funcs[1]){
		var subtype = fnc.subtype;
		if(fnc.mirror.run){
			// already run
			continue;
		}
		if(subtype === 'sync'){
			var value = this.callbacks[0][fnc.name](this.state);
			cb.call(this, fnc, true, value);
		} else {
			if(!this.callbacks[0]){
				console.error('You should provide a callback object with "' + fnc.name + '" key!');
			}
			if(!(this.callbacks[0][fnc.name] instanceof Function)){
				console.error('Expecting ' + fnc.name + ' to be a function, given', typeof this.callbacks[0][fnc.name], 'instead!');
			}
			this.callbacks[0][fnc.name](this.state, cb.bind(this, fnc));
		}
		fnc.mirror.run = true;
	}
	// @todo: check for linked chex' and activate them
}

Chex.prototype.get_active_cells_and_funcs = function(parent, parent_mirror, branch, mirror, cells = new Set, funcs = new Set){
	var res = [];
	if(branch.type === 'func'){
		cells.add(branch.name);
		funcs.add(Object.assign({parent_mirror: parent_mirror, mirror: mirror, parent: parent}, branch));
		return [cells, funcs];
	}
	if(branch.type === 'revolver'){
		if(!mirror.children){
			mirror.children = [];
		}
		switch(branch.subtype){
			case '>':
				mirror.pos = mirror.pos || 0;
				if(!branch.children[mirror.pos]){
					// revolver finished
					return [cells, funcs];
				}
				
				var p = mirror.pos;
				do {
					if(!mirror.children[p]) mirror.children[p] = {children: []};
					//console.log('traversing >', branch.children, p);
					this.get_active_cells_and_funcs(branch, mirror, branch.children[p], mirror.children[p], cells, funcs);
					p++;
				} while(
					(
						branch.children[p - 1] && !(!branch.children[p - 1].quantifier || branch.children[p-1].max)
					)
					||
					branch.children[p - 1].type === 'func'
				)
			break;
			default:
				for(let p in branch.children){
					if(!mirror.children[p]){
						mirror.children[p] = {
							children: [],
							//parent: mirror,
							//type: branch.subtype,
							//id: ++mirids
						};
					}
					this.get_active_cells_and_funcs(branch, mirror, branch.children[p], 
					mirror.children[p], cells, funcs);
				}
				//console.log('Activate each part of revolver');
			break;
		}
	} else {
		if(!branch.event){
			console.log('So what is it?', branch);
		}
		switch(branch.event.type){
			case 'cell':
				cells.add(branch.event.name);
			break;
			case 'revolver':
				/*if(!mirror.children[0]){
					console.log('~~~~~~~ ADD CHILD TO MIRROR___________', mirids+1, branch, mirror);
					mirror.children[0] = {
						children: [],
						parent: mirror,
						type: branch.event.subtype,
						id: ++mirids
					};
				}*/
				this.get_active_cells_and_funcs(branch, mirror, branch.event, 
				mirror, cells, funcs);
			break;
		}
	}
	return [cells, funcs];
}

Chex.prototype.drip = function(cellname, val){
	//console.log('dripping', cellname);
	if(this.finished){
		//console.log('No way, it\'s over!');
		return;
	}
	if(this.sleeping){
		//console.log('No, I\'m sleeping!');
		return;
	}
	if(!this.needed_events.has(cellname)){
		//console.log('We are not interested in this event now', cellname);
		return;
	}
	var res = this.absorb(this.struct, this.mirror, cellname, val);
	this.activate_needed_events();
	//console.log('____dripped', this.needed_events);
	if(is_luck(res)){
		// pattern done
		//console.log('________ FINISH!');
		this.finished = true;
		this.mirror = {
			children: [],
		};
		if(this.onSuccess){
			this.onSuccess();
		}
	}
}

module.exports = {
	create: function(che_expression, linking, ...callbacks){
		var struct;
		if(parsed_pool[che_expression]){
			struct = parsed_pool[che_expression];
		} else {
			struct = parsed_pool[che_expression] = parser(che_expression);
		}
		//console.log('Sem', struct.semantics);
		var state = new Chex(struct.semantics, linking, callbacks);
		return state;
	},
}