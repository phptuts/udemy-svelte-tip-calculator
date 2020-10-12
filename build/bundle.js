var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src/App.svelte generated by Svelte v3.29.0 */

    function create_fragment(ctx) {
    	let main;
    	let section0;
    	let t1;
    	let section1;
    	let div1;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let section2;
    	let div2;
    	let label1;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let input1;
    	let t9;
    	let section3;
    	let div3;
    	let button0;
    	let t11;
    	let div4;
    	let button1;
    	let t13;
    	let div5;
    	let button2;
    	let t15;
    	let section4;
    	let div6;
    	let h2;
    	let t16;
    	let t17;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			section0 = element("section");
    			section0.innerHTML = `<div class="column"><h1 class="svelte-r6f3vh">Tip Calculator</h1></div>`;
    			t1 = space();
    			section1 = element("section");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Price";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			section2 = element("section");
    			div2 = element("div");
    			label1 = element("label");
    			t5 = text("Tip (");
    			t6 = text(/*tip*/ ctx[1]);
    			t7 = text("%)");
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			section3 = element("section");
    			div3 = element("div");
    			button0 = element("button");
    			button0.textContent = "15%";
    			t11 = space();
    			div4 = element("div");
    			button1 = element("button");
    			button1.textContent = "25%";
    			t13 = space();
    			div5 = element("div");
    			button2 = element("button");
    			button2.textContent = "30%";
    			t15 = space();
    			section4 = element("section");
    			div6 = element("div");
    			h2 = element("h2");
    			t16 = text("Calculated Tip: ");
    			t17 = text(/*tipAmount*/ ctx[2]);
    			attr(section0, "class", "row");
    			attr(label0, "for", "price");
    			attr(input0, "type", "number");
    			attr(input0, "id", "price");
    			attr(div1, "class", "column");
    			attr(section1, "class", "row");
    			attr(label1, "for", "tip");
    			attr(input1, "type", "range");
    			attr(input1, "min", "0");
    			attr(input1, "max", "100");
    			attr(input1, "step", "1");
    			attr(input1, "id", "tip");
    			attr(input1, "class", "svelte-r6f3vh");
    			attr(div2, "class", "column");
    			attr(section2, "class", "row");
    			attr(button0, "class", "button svelte-r6f3vh");
    			toggle_class(button0, "button-outline", /*tip*/ ctx[1] !== 15);
    			attr(div3, "class", "column");
    			attr(button1, "class", "button svelte-r6f3vh");
    			toggle_class(button1, "button-outline", /*tip*/ ctx[1] !== 25);
    			attr(div4, "class", "column");
    			attr(button2, "class", "button svelte-r6f3vh");
    			toggle_class(button2, "button-outline", /*tip*/ ctx[1] !== 30);
    			attr(div5, "class", "column");
    			attr(section3, "class", "row");
    			attr(h2, "class", "svelte-r6f3vh");
    			attr(div6, "class", "column");
    			attr(section4, "class", "row");
    			attr(main, "class", "container");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, section0);
    			append(main, t1);
    			append(main, section1);
    			append(section1, div1);
    			append(div1, label0);
    			append(div1, t3);
    			append(div1, input0);
    			set_input_value(input0, /*price*/ ctx[0]);
    			append(main, t4);
    			append(main, section2);
    			append(section2, div2);
    			append(div2, label1);
    			append(label1, t5);
    			append(label1, t6);
    			append(label1, t7);
    			append(div2, t8);
    			append(div2, input1);
    			set_input_value(input1, /*tip*/ ctx[1]);
    			append(main, t9);
    			append(main, section3);
    			append(section3, div3);
    			append(div3, button0);
    			append(section3, t11);
    			append(section3, div4);
    			append(div4, button1);
    			append(section3, t13);
    			append(section3, div5);
    			append(div5, button2);
    			append(main, t15);
    			append(main, section4);
    			append(section4, div6);
    			append(div6, h2);
    			append(h2, t16);
    			append(h2, t17);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen(input1, "change", /*input1_change_input_handler*/ ctx[5]),
    					listen(input1, "input", /*input1_change_input_handler*/ ctx[5]),
    					listen(button0, "click", /*click_handler*/ ctx[6]),
    					listen(button1, "click", /*click_handler_1*/ ctx[7]),
    					listen(button2, "click", /*click_handler_2*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*price*/ 1 && to_number(input0.value) !== /*price*/ ctx[0]) {
    				set_input_value(input0, /*price*/ ctx[0]);
    			}

    			if (dirty & /*tip*/ 2) set_data(t6, /*tip*/ ctx[1]);

    			if (dirty & /*tip*/ 2) {
    				set_input_value(input1, /*tip*/ ctx[1]);
    			}

    			if (dirty & /*tip*/ 2) {
    				toggle_class(button0, "button-outline", /*tip*/ ctx[1] !== 15);
    			}

    			if (dirty & /*tip*/ 2) {
    				toggle_class(button1, "button-outline", /*tip*/ ctx[1] !== 25);
    			}

    			if (dirty & /*tip*/ 2) {
    				toggle_class(button2, "button-outline", /*tip*/ ctx[1] !== 30);
    			}

    			if (dirty & /*tipAmount*/ 4) set_data(t17, /*tipAmount*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function calculatedTip(price, tip) {
    	const calcTip = price * (tip / 100);
    	return calcTip.toLocaleString("en-US", { style: "currency", currency: "USD" });
    }

    function instance($$self, $$props, $$invalidate) {
    	let price = 12.51;
    	let tip = 15;

    	function changeTip(newTip) {
    		$$invalidate(1, tip = newTip);
    	}

    	function input0_input_handler() {
    		price = to_number(this.value);
    		$$invalidate(0, price);
    	}

    	function input1_change_input_handler() {
    		tip = to_number(this.value);
    		$$invalidate(1, tip);
    	}

    	const click_handler = () => changeTip(15);
    	const click_handler_1 = () => changeTip(25);
    	const click_handler_2 = () => changeTip(30);
    	let tipAmount;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*price, tip*/ 3) {
    			 $$invalidate(2, tipAmount = calculatedTip(price, tip));
    		}
    	};

    	return [
    		price,
    		tip,
    		tipAmount,
    		changeTip,
    		input0_input_handler,
    		input1_change_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
