define([
	"./d3",
	"./moment",
	"./codemirror",
	"./javascript",
	"css!./codemirror.css",
    "css!./ui.css"
],function (
	d3,
    moment,
    codemirror
) {
	"use strict";
    var undefined;
    window.px = "px";
    patchD3(d3);
	var ui = new uiCore();
    ui.nodes = new uiNodes();
    ui.templates = new uiTemplates();
    ui.utils = new uiUtils();
    ui.models = new uiModels();
    ui.icons = new uiIcons();
    ui.events = new uiEvents();
	ui.symbols = new uiSymbols();
	ui.dev = new uiDev();
    ui.math = new uiMath();
    var uiNode = ui.Node;
    var uiTemplate = ui.Template;
    function uiCore(){
        this.Node = uiNode;
        this.Template = uiTemplate;
        this.Array = uiArray;
        var nodeIdGen = new IdGenerator;
        var templateIdGen = new IdGenerator;
        function IdGenerator(){
            var id = 0;
            this.getId = function(){ id++; return id; }
        }	
        function uiDefinition(){
            this.property = {};
            this.attr = {};
            this.style = {};
            this.on = {};
            this.classed = {};
        }
        function uiCollection(){
        }
        uiCollection.prototype.each = function (func, recursive){
            var constructor = this.constructor;
            for (var i in this){
                if(!this.hasOwnProperty(i)) continue;
                var nodeConstr = this[i].constructor;
                if (recursive && nodeConstr == constructor)
                    uiCollection.prototype.each.call(this[i], func, recursive);
                else
                    func.call(this, this[i], i);
            }
        }
        uiCollection.prototype.setBefore = function (beforeKey, key, value){
            var setted = false;
            this.each(function(d, i){
                if (i === beforeKey){
                    setted = true;
                    this[key] = value;
                }
                if (setted){
                    delete this[i];
                    this[i] = d;
                }
            })
            if (!setted) throw new Error("key " + beforeKey + " not found");
        }
        uiCollection.prototype.setAfter = function (afterKey, key, value){
            var setted = false;
            this.each(function(d, i){
                if (setted){
                    delete this[i];
                    this[i] = d;
                }
                if (i === afterKey){
                    setted = true;
                    this[key] = value;
                }
            })
            if (!setted) throw new Error("key " + afterKey + " not found");
        }
        function uiReference(){
        }
        uiReference.prototype = new uiCollection;
        uiReference.prototype.addElement = function(path, element){
            var pathArray = path.split(".");
            var location = this;
            pathArray.forEach(function(item, i, arr){
                if (i == arr.length - 1){
                    location[item] = element;
                }
                else{
                    if (!(location[item] instanceof uiReference))
                        location[item] = new uiReference();
                    location = location[item];
                }
            })
        }
        function uiArray(config){
            if (typeof config === "undefined") config = {};
            if (config.ref) this.ref = config.ref;
            this.length = 0;
        }
        uiArray.prototype = new Array;
        uiArray.prototype.each = uiArray.prototype.forEach;
        function uiNode(nodeDef){
			nodeDef || (nodeDef = {});
            var undefined;
            this.node = nodeDef.node || "div";
            this.ref = nodeDef.ref;
            this.model = {};
            this.enter = new uiDefinition();
            this.update = new uiDefinition();
            this.childs = new uiCollection();
            this.data = {array:undefined, key:undefined};
            this.datum = {array:undefined, update:new uiDefinition()};
            this.on = {enter:undefined, update:undefined, exit:undefined};
        }
        function bindParent(parent){
            this.parent = parent;
            if (!parent.childComponents)
                parent.childComponents = new uiCollection();
            parent.childComponents[this.id] = this;
            this.updateChildComponents = function (config){
                this.elements.each(updateElement);
                function updateElement(element, el, ind){
                    if (element instanceof ui.Array && typeof ind === "undefined"){
                        element.each(function(item, i){
                            updateElement(element, el, i);
                        })
                        return;
                    }
                    else if (element instanceof ui.Array){
                        element = element[ind];
                    } 
                    updateNode(element);
                    //element.selection.each(updateNode);
                    element.childs.each(updateElement);
                    function updateNode(node){
                        if (node.childComponents){
                            node.childComponents.each(function(item){
                                item.update(config);
                            })
                        }
                    }
                }
            }
            
        }
        function uiTemplate(templateDef){
            templateDef || (templateDef = {});
			this.factory = templateDef.factory || "uiTemplate";
            this.module = templateDef.module;
            this.model = {};
            this.elements = new uiCollection();
            this.ref = new uiReference();
            this.enter = enter.bind(this);
            this.update = update.bind(this);
            this.exit = exit.bind(this);
            this.updateRef = updateRef.bind(this);
			function enter(uiParentNode){
				if (typeof uiParentNode.selection === "undefined") {
					if (uiParentNode.d3element)  uiParentNode.selection = uiParentNode.d3element
					else uiParentNode.selection = d3.select(uiParentNode);
				}
					
				if (this.id){
					this.exit();
				}
				this.id = templateIdGen.getId();
				bindParent.call(this, uiParentNode);
				createElements(templateDef, uiParentNode, this.elements);
                callTemplateDispatch("enter");
			}
			function update(config){
				if (typeof this.id === "undefined") return;
				joinElements(templateDef, this.parent, this.elements);
				updateElements(this.parent, this.elements, config);
				if (config){
					if (config.updateChildComponents)
						this.updateChildComponents({updateChildComponents:true});
				}
			}
			function exit(){
				if (this.id){
					this.elements.each(releaseNode);
					delete this.parent.childComponents[this.id];
					delete this.id;
				}
                callTemplateDispatch("exit");
			}	
		}
		var templateDispatch = d3.dispatch(
            "enter",    //событие создания шаблона (template.enter()) 
            "update",   //событие обновления шаблона (template.update())
            "exit"      //событие очистки шаблона (template.exit())
        );
        //таймауты обеспечивают вызов только одного события при последовательном изменении множества шаблонов
        var timeouts = {
            enter:undefined,
            update:undefined,
            exit:undefined
        }
		uiTemplate.on = templateDispatch.on.bind(templateDispatch);	
		function callTemplateDispatch(event){
			clearTimeout(timeouts[event]);
			timeouts[event] = setTimeout(function(){
				templateDispatch.call(event);
			}, 0);
		}
		function releaseNode(node){
			if (node instanceof ui.Array){
				node.each(releaseNode);
			}
			else {
				node.childs.each(releaseNode);
				node.selection.each(function(){
					if (this.childComponents){
						this.childComponents.each(function(item) { item.exit() })
						delete this.childComponents;
					}
				})
				node.selection.remove();
				if (node.childComponents){
					node.childComponents.each(function(item) { item.exit() })
					delete node.childComponents; 
				}
				delete node.parent; 
			}
		}
		function updateRef(){
			var self = this;
			this.elements.each(function(element){
				updateNodeRef(element);
			});
			function updateNodeRef(node){
				if (node.ref){
					self.ref.addElement(node.ref, node);
				}
				if (node instanceof ui.Array){
					node.each(function(element){
						updateNodeRef(element);
					});
				}
				else {
					node.childs.each(function(element){
						updateNodeRef(element);
					});
				}                    
			}
		}        
		
		function uiAttr(templateDef, element, el, ind){
			var moduleName = templateDef.module;
			var factoryName = templateDef.factory;
			var attr = {};
			if (moduleName) attr["d3ui-module"] = moduleName;
			if (factoryName) attr["d3ui-factory"] = factoryName;
			if (el) attr["d3ui-node"] = el;
			if (ind) attr["d3ui-index"] = ind;
			if (element.id) attr["d3ui-id"] = element.id;
			return { attr:attr }
		}
		function createElements(templateDef, parentElement, elements){
			elements.each(function(element, el){
				appendElement(element, el);
			})
			function appendElement(element, el, ind){
				if (element instanceof ui.Array && typeof ind === "undefined"){
					element.each(function(item, i){
						appendElement(element, el, i);
					})
					return;
				}
				else if (element instanceof ui.Array) element = element[ind];
				element.parent = parentElement;
				element.id = nodeIdGen.getId();
				element.key = el;
				element.selector = element.node + "[d3ui-id='"+element.id+"']";
				
				if (element.data.array) {
					element.type = "join";
					var selection = parentElement.selection;
					var join = selection.selectAll(element.selector).data(element.data.array, element.data.key);
					
					element.exited = join.exit();
					exitElement(element, true);
					
					element.entered = join.enter().append(element.node)
						.applyAll(element.enter)
						.applyAll(uiAttr(templateDef, element, el, ind));
					if (element.entered && element.entered.nodes().length) {
						element.on.enter && element.on.enter.call(element);
                        callTemplateDispatch("update");
					}
					
					element.selection = element.entered.merge(join);
				}
				else {
					if (parentElement.type == "join"){
						element.type = "join";
						element.entered = parentElement.entered.append(element.node)
							.applyAll(element.enter)
							.applyAll(uiAttr(templateDef, element, el, ind));
						if (element.entered && element.entered.nodes().length) {
							element.on.enter && element.on.enter.call(element);
                            callTemplateDispatch("update");
						}
						element.selection = parentElement.selection.select(element.selector);
					}
					else{
						element.type = "element";
						element.selection = parentElement.selection.append(element.node)
							.applyAll(element.enter)
							.applyAll(uiAttr(templateDef, element, el, ind));
						element.entered = element.selection;
						if (element.entered && element.entered.nodes().length) {
							element.on.enter && element.on.enter.call(element);
                            callTemplateDispatch("update");
						}
					}
				}
				
				if (element.datum.array){
					element.selection.datum(element.datum.array).applyAll(element.datum.update);
				}
				createElements(templateDef, element, element.childs);   		
			};
		};
		function exitElement(element, top){
			if (typeof element.exited === "undefined" || element.exited.nodes().length === 0) return;
			if (typeof element.exited === "undefined") element.exited = element.parent.exited.select(element.selector);
			if (element.childComponents) element.childComponents.each(function(item) { item.elements.each(exitElement)});
			element.childs.each(exitElement);
			if (element.exited && element.exited.nodes().length) {
				element.on.exit && element.on.exit.call(element);
			}
			if (top === true) element.exited.remove();
			delete element.exited;
			
			callTemplateDispatch("update");
		}
		function joinElements(templateDef, parentElement, elements){
			elements.each(function(element, el){
				joinElement(element, el);
			})
			function joinElement(element, el, ind){
				if (element instanceof ui.Array && typeof ind === "undefined"){
					element.each(function(item, i){
						joinElement(element, el, i);
					})
					return;
				}
				else if (element instanceof ui.Array) element = element[ind];
				if (element.data.array){
					var selection = parentElement.selection;
					var data = selection.selectAll(element.selector).data(element.data.array, element.data.key);
					
					element.exited = data.exit();
					exitElement(element, true);
					
					element.entered = data.enter().append(element.node)
						.applyAll(element.enter)
						.applyAll(uiAttr(templateDef, element, el, ind));
					if (element.entered && element.entered.nodes().length) {
						element.on.enter && element.on.enter.call(element);
                        callTemplateDispatch("update");
					}
					
					element.selection = element.entered.merge(data);
				}
				else if (parentElement.type === "join"){
                    var selectionChanged = checkSelectionChanged(parentElement.selection["_groups"], element.selection["_groups"]);
                    if (selectionChanged){
                        element.entered = parentElement.entered.append(element.node)
						.applyAll(element.enter)
						.applyAll(uiAttr(templateDef, element, el, ind));
                        if (element.entered && element.entered.nodes().length) {
                            element.on.enter && element.on.enter.call(element);
                            callTemplateDispatch("update");
                        }
                    }
                    element.selection = parentElement.selection.select(element.selector);
				}
                else{
                    element.selection = parentElement.selection.select(element.selector);
                }
				joinElements(templateDef, element, element.childs);
			}
            function checkSelectionChanged(parentGroup, nodeGroup){
                if (parentGroup.length != nodeGroup.length) return true;
                var changed = false;
                if (parentGroup.length && parentGroup[0] instanceof Array) {
                    parentGroup.forEach(function(item, i){
                        changed = changed || checkSelectionChanged(parentGroup[i], nodeGroup[i])
                    })
                }
                return changed;
            }
		}
		function updateElements(parentElement, elements, config){
			if (typeof config === "undefined") config = {};
			elements.each(function(element, el){
				updateElement(element, el);
			})
			function updateElement(element, el, ind){
				if (element instanceof ui.Array && typeof ind === "undefined"){
					element.each(function(item, i){
						updateElement(element, el, i);
					})
					return;
				}
				else if (element instanceof ui.Array) element = element[ind];
				if (element.datum.array && typeof element.data.array === "undefined"){
					element.selection.datum(function(){
						return this.parentNode["__data__"];
					})
				}
				var selection = element.selection;
				if (config.transition)	selection = selection.transition(config.transition);
				selection.applyAll(element.update);
				
				if (element.datum.array){
					selection.datum(element.datum.array).applyAll(element.datum.update);
				}
				if (element.on.update && element.selection.nodes().length) element.on.update.call(element);
				updateElements(element, element.childs, config);
			}
		}
    }
    function uiEvents(){
        this.disableEvents = disableEvents;
        function disableEvents(){
            var target = this;
            clearTimeout(target.uiTimer);
            if( !target.classList.contains( 'disableEvents' ) ) {
                target.classList.add( 'disableEvents' )
            }
            target.uiTimer = setTimeout( function() {
                target.classList.remove( 'disableEvents' )	
                delete target.uiTimer;
            }, 500 );
        }
    }
    function uiNodes(){
        this.LinearGradient = uiLinearGradientNode;
        function uiLinearGradientNode(nodeDef){
            var self = this;
            var gradDef = {}, stopDef = [];
            if (nodeDef && nodeDef.gradDef) gradDef = nodeDef.gradDef;
            if (nodeDef && nodeDef.stopDef) stopDef = nodeDef.stopDef;

            ui.Node.call(self, {node:"linearGradient"});
            self.enter.attr = gradDef;
            self.childs.stop = new ui.Array();
            stopDef.forEach(function(item){
                var stop = new ui.Node({node:"stop"});
                stop.enter.attr = item;
                self.childs.stop.push(stop);
            })
        }
        this.html = new HtmlNodes();
        function HtmlNodes(){
            this.Rect = uiDivRect;
            function uiDivRect(nodeDef){
                if (typeof nodeDef === "undefined") nodeDef = {};
                
                ui.Node.call(this, {node:"div", ref:nodeDef.ref});
                var model = {
                    x1:new ui.models.Dimension(),
                    y1:new ui.models.Dimension(),
                    x2:new ui.models.Dimension(),
                    y2:new ui.models.Dimension()
                };
                this.model = model;
                this.update.style = function(d, i, arr){
                    var x1 = model.x1.calc.call(this, d, i, arr),
                        x2 = model.x2.calc.call(this, d, i, arr),
                        y1 = model.y1.calc.call(this, d, i, arr),
                        y2 = model.y2.calc.call(this, d, i, arr);
                    var x = d3.min([x1, x2]);
                    var y = d3.min([y1, y2]);
                    var width = Math.abs(x1-x2);
                    var height = Math.abs(y1-y2);
                    return {
                        position:"absolute",
                        left:x + "px",
                        top:y + "px",
                        width:width + "px",
                        height:height + "px"
                    }
                }
            }
            this.Select = SelectNode;
            function SelectNode(config){
                config = config || {};
                ui.Node.call(this, {node:"select"});
                this.childs.option = new ui.Node({node:"option"});
                if (config.ref) {
                    var rootRef = config.ref += ".";
                    this.ref = rootRef+"select";
                    this.childs.option.ref = rootRef+"option";
                }
            }
        } 
        
        this.svg = new SvgNodes();
        function SvgNodes(){
            this.Path = uiSvgPathNode;
            this.Line = uiSvgLineNode;
            this.Circle = uiSvgCircleNode;
            this.Rect = uiSvgRectNode;
            this.markers = new Markers();
            function uiSvgPathNode(nodeDef){
                if (typeof nodeDef === "undefined") nodeDef = {};
                nodeDef.node = "path";
                ui.Node.call(this, nodeDef);
                if (nodeDef.model){
                    var model = new nodeDef.model();
                    this.model = model;
                    this.datum.array = [];
                    this.datum.update.attr.d = this.model.generator; 
                }
            }
            function uiSvgCircleNode(nodeDef){
                if (typeof nodeDef === "undefined") nodeDef = {};
                nodeDef.node = "circle";
                ui.Node.call(this, nodeDef);
                var model = {
                    x:new ui.models.Dimension(),
                    y:new ui.models.Dimension()
                };
                this.model = model;
                this.update.attr.cx = model.x.calc;
                this.update.attr.cy = model.y.calc;
            }
            function uiSvgRectNode(nodeDef){
                if (typeof nodeDef === "undefined") nodeDef = {};
                
                ui.Node.call(this, {node:"rect", ref:nodeDef.ref});
                var model = {
                    x1:new ui.models.Dimension(),
                    y1:new ui.models.Dimension(),
                    x2:new ui.models.Dimension(),
                    y2:new ui.models.Dimension()
                };
                this.model = model;
                this.update.attr = function(d, i, arr){
                    var x1 = model.x1.calc.call(this, d, i, arr),
                        x2 = model.x2.calc.call(this, d, i, arr),
                        y1 = model.y1.calc.call(this, d, i, arr),
                        y2 = model.y2.calc.call(this, d, i, arr);
                    var attr = {
                        x:d3.min([x1, x2]),
                        y:d3.min([y1, y2]),
                        width:Math.abs(x1-x2),
                        height:Math.abs(y1-y2)
                    };
                    return attr
                }
            }
            function uiSvgLineNode(nodeDef){
                if (typeof nodeDef === "undefined") nodeDef = {};
                ui.Node.call(this, {node:"line", ref:nodeDef.ref});
                var model = {
                    x1:new ui.models.Dimension(),
                    y1:new ui.models.Dimension(),
                    x2:new ui.models.Dimension(),
                    y2:new ui.models.Dimension()
                };
                this.model = model;
                this.update.attr.x1 = function(d, i, arr) { return model.x1.calc.call(this, d, i, arr)};
                this.update.attr.y1 = function(d, i, arr) { return model.y1.calc.call(this, d, i, arr)};
                this.update.attr.x2 = function(d, i, arr) { return model.x2.calc.call(this, d, i, arr)};
                this.update.attr.y2 = function(d, i, arr) { return model.y2.calc.call(this, d, i, arr)};
            }
            function Markers(){
                this.Arrow = uiArrowMarkerNode;
                function uiArrowMarkerNode(nodeDef){
                    if (typeof nodeDef === "undefined") nodeDef = {};
                    uiNode.call(this, { node:"marker", ref:nodeDef.ref });
                    this.enter.attr = { viewBox:"0 0 10 10", refX:10, refY:5, markerWidth:6, markerHeight:6, orient:"auto" }
                    this.childs.line = new uiNode({node:"path"});
                    this.childs.line.enter.attr.d = "M 0 0 L 10 5 L 0 10";
                    this.childs.line.enter.style = {
                        fill:"transparent",
                        stroke:"black"
                    };
                }
            }
        }

    }
    function uiMath(){
        this.arFromXy = arFromXy;
        this.arToXy = arToXy;
        function arFromXy(x, y){
            var r = Math.sqrt(x*x + y*y);
            var a;
            if (x > 0 && y >= 0) a = Math.atan(y/x);
            else if (x > 0 && y < 0) a = Math.atan(y/x) + Math.PI*2;
            else if (x > 0 && y < 0) a = Math.atan(y/x) + Math.PI*2;
            else if (x < 0) a = Math.atan(y/x) + Math.PI;
            else if (x > 0 && y < 0) a = Math.PI/2;
            else if (x > 0 && y < 0) a = Math.PI*3/2;
            else a = 0;
            return {a:a, r:r};
        }
        function arToXy(a, r){
            return {x:r*Math.cos(a), y:r*Math.sin(a)}
        }
    }
    function uiIcons(){
        this.lui = function (type) { return "<span class='lui-icon lui-icon--"+type+"'></span>"; };
    }
    function uiTemplates(){
        this.BasicTemplate = BasicTemplate;
        this.CalendarDateRange = uiCalendarDateRange;
        this.CalendarPanel = uiCalendarPanel;
        this.RegularPolygon = RegularPolygon;
        this.Tooltip = Tooltip;
        this.Plot = Plot;
        this.Grid = uiGrid;
        this.DropButton = DropButton;
        this.SelectBox = SelectBox;
        //this.DropButton = DropButton;
        this.ReqursiveObject = ReqursiveObject;
		this.ReqursiveXml = ReqursiveXml;
        this.animations = new AnimationTemplates();
        this.placeholders = new Placeholders();
        
        function BasicTemplate(config) {
            config || (config = {});
            config.elements || (config.elements = {});
            ui.Template.call( this, {factory:config.factory || "BasicTemplate", module:config.module} );
            var elements = this.elements;
            ui.utils.each.call(config.elements, function(item, key){
                elements[key] = new ui.Node({ref:key, node:item});
            })
            this.updateRef();
        }
        function DropButton(config) {
            config || (config = {});
            var autoHide = true;
            if (typeof config.autoHide != "undefined") autoHide = config.autoHide;
            var self = this;
            var display = false;
            var dispatch = d3.dispatch("hide", "show");
            self.on = dispatch.on.bind(dispatch);
            ui.Template.call( self, {factory:"DropButton", module:config.module} );
            self.elements.button = new ui.Node( {ref:'button'} );
            self.elements.button.childs.label = new ui.Node( {node:'span', ref:'label'} );
            self.elements.button.childs.icon = new ui.Node( {node:'span', ref:'icon'} );
            self.elements.drop = new ui.Node( {ref:'drop'} );
            self.updateRef();
            
            self.ref.button.enter.on.click = toogle;
            self.ref.drop.enter.style.display = "none";
            self.ref.drop.update.style.display = function(){ return display?"block":"none" };
            self.getDisplay = getDisplay;
            self.toogle = toogle;	
            self.show = show;	
            self.hide = hide;

            function getDisplay(){
                return display;
            };
            function toogle(){
                if (!display) show();
                else hide();
            }
            function show(){
                display = true;
                self.update();
                createListeners();
                dispatch.call("show");
            }
            function hide(){
                display = false;
                self.update();
                removeListeners();
                dispatch.call("hide");
            }
            function checkClick(){
                var button = self.ref.button.selection.node();
                var drop = self.ref.drop.selection.node();
                var target = this;

                if (target == button || target == drop) event.stopPropagation();
                if (autoHide && target != button && target != drop) hide();
            }
            function createListeners(){
                setTimeout(function() {
                    document.addEventListener("click", checkClick, false);
                    self.ref.button.selection.node().addEventListener("click", checkClick, false);
                    self.ref.drop.selection.node().addEventListener("click", checkClick, false);
                },0);
            }
            function removeListeners(){
                setTimeout(function() {
                    document.removeEventListener("click", checkClick, false);
                    self.ref.button.selection.node().removeEventListener("click", checkClick, false);
                    self.ref.drop.selection.node().removeEventListener("click", checkClick, false);
                },0);
            }
        };
        function SelectBox(def){
            if (typeof def === 'undefined') def = {};
            ui.Template.call( this, {factory:"SelectBox", module:def.module} );
            this.elements.select = new ui.Node( {node:'select', ref:'select'} );
            this.elements.select.childs.option = new ui.Node( {node:'option', ref:'option'} );
            this.updateRef();
        }
        function ReqursiveObject(config){ 
            config || (config = {});
            config.constructors || (config.constructors = {});
			var showConstructor = config.showConstructor || false;
			var showPrototype = config.showPrototype || false;
			var constructors = {
				Object:config.constructors.Object || ReqursiveObject,
				Array:config.constructors.Array || ReqursiveObject,
				Function:config.constructors.Function || FunctionListing,
				Primitive:config.constructors.Primitive || Primitive
			}
			config.constructors = constructors;
			var ObjectConstructor = config.ObjectConstructor || ReqursiveObject;
			var ArrayConstructor = config.ArrayConstructor || ReqursiveObject;
			var PrimitiveConstructor = config.PrimitiveConstructor || Primitive;
            var data = config.data; 
            ui.Template.call(this, {factory:config.factory || "ReqursiveObject"}); 
            this.elements.wrap = new ui.Node({ref:"wrap"}); 
			this.elements.wrap.childs.fields = new ui.Node({ref:"fields"}); 
            this.elements.wrap.childs.fields.childs.arrow = new ui.Node({node:"span", ref:"arrow"}); 
            this.elements.wrap.childs.fields.childs.key = new ui.Node({node:"span", ref:"key"}); 
            this.elements.wrap.childs.fields.childs.separator = new ui.Node({node:"span", ref:"separator"}); 
            this.elements.wrap.childs.fields.childs.constructor = new ui.Node({node:"span", ref:"constructor"}); 
            this.elements.wrap.childs.fields.childs.open = new ui.Node({node:"span", ref:"bracket.open"}); 
            this.elements.wrap.childs.fields.childs.value = new ui.Node({node:"div", ref:"value"}); 
            this.elements.wrap.childs.fields.childs.close = new ui.Node({node:"span", ref:"bracket.close"}); 
            this.updateRef(); 
            var valueNode = this.ref.value; 
            var arrowNode = this.ref.arrow; 
            this.ref.arrow.update.html = function(d, i) { 
                var valueDom = d3.select(this.parentNode).select(valueNode.selector).node(); 
                if (d && d.value instanceof Object){
                    if (valueDom.uiChild instanceof HiddenObject){ 
                        return ui.symbols.utf8.arrow.right; 
                    } 
                    return ui.symbols.utf8.arrow.down;
                }
                return "";
            }
            this.ref.key.update.html = function(d, i) { return d?d.key:"" }; 
            var baseUpdate = this.update; 
            this.update = function(config){ 
                config || (config = {});
                data = config.data || data; 
                baseUpdate.call(this); 
            }; 
			this.ref.separator.enter.html = ":";
            this.ref.constructor.update.html = function(d, i) { 
                var html = ""; 
                if (d.value instanceof Array) return html+= "Array ("+d.value.length + ")"; 
                else if (d.value instanceof Object && d.value && d.value.constructor && d.value.constructor.name) html += ""+d.value.constructor.name + ""; 
                return html; 
            } 
            this.ref.bracket.open.update.html = function(d, i) { 
                if (d.value instanceof Array) return "["; 
                else if (d.value instanceof Object) return "{"; 
                return ""; 
            } 
            this.ref.bracket.close.update.html = function(d, i) { 
                if (d.value instanceof Array) return "]"; 
                else if (d.value instanceof Object) return "}"; 
                return ""; 
            } 
            this.ref.fields.data.array = function(d){ 
				var sourceData;
				if (data) sourceData = data;
				else if (d) sourceData = d.value;
                var targetArray = [];
                if (sourceData instanceof Array) { 
					var partitionSize = 100;
					if (sourceData.length > partitionSize){
						var partition = new Partition;
						var partitions = [];
						for (var i = 0; i < sourceData.length; i++){
							partition[i] = data[i];
							if (!((i+1)%partitionSize)){
								var start = i - partitionSize + 1;
								var end = i;
								partitions.push({start:start, end:end, partition:partition})
								partition = new Partition;
							}
							else if (i === sourceData.length - 1){
								var start = i-i%partitionSize;
								var end = i;
								partitions.push({start:start, end:end, partition:partition})
								partition = new Partition;
							}
						}
                    	targetArray = partitions.map(function(d, i) { return {key:"["+d.start+"..."+d.end+"]", value:d.partition, sourceData:sourceData}});
						
					}
					else{
                    	targetArray = sourceData.map(function(d, i) { return {key:i, value:d, sourceData:sourceData}});
					} 
                } 
                else{ 
                    for (var i in sourceData){ 
                        if (!sourceData.hasOwnProperty(i)) continue; 
                            targetArray.push({key:i, value:sourceData[i], sourceData:sourceData}) 
                    } 
                } 
				if (showPrototype && typeof sourceData == "function"){
					targetArray.push({key:"__proto__", value:sourceData.prototype, sourceData:sourceData});
				}
				else if (showConstructor && sourceData && sourceData.constructor){
					targetArray.push({key:"__constructor__", value:sourceData.constructor, sourceData:sourceData});
				}
                return targetArray; 
            }
            function Partition(){};
            this.ref.arrow.enter.on.click = function(d, i){ 
                var valueDom = d3.select(this.parentNode).select(valueNode.selector).node(); 
                if (d.value instanceof Object){ 
                    if (valueDom.uiChild instanceof HiddenObject){ 
                        valueDom.uiChild.exit(); 
						if (typeof d.value == "function"){
							valueDom.uiChild = new constructors.Function(config);
						}
						else if (d.value instanceof Array){ 
							valueDom.uiChild = new constructors.Array(config);
						}
						else{
							valueDom.uiChild = new constructors.Object(config); 
						}
                        valueDom.uiChild.enter(valueDom); 
                        valueDom.uiChild.update();
                        valueDom.style.display = "block";
                        this.innerHTML = ui.symbols.utf8.arrow.down;
                    } 
                    else{ 
                        valueDom.uiChild.exit(); 
                        valueDom.uiChild = new HiddenObject(); 
                        valueDom.uiChild.enter(valueDom);  
                        valueDom.uiChild.update();
                        valueDom.style.display = "inline-block"; 
                        this.innerHTML = ui.symbols.utf8.arrow.right;
                    } 
                } 
            } 
            this.ref.value.update.style.display = function(d, i){ 
                if (this.uiChild instanceof constructors.Array || this.uiChild instanceof constructors.Object){ 
                    return "block" 
                } 
                return "inline-block"; 
            } 
            this.ref.value.on.enter = function(){ 
                this.entered.each(function(d, i){ 
                    if (d.value instanceof Object){ 
                        this.uiChild = new HiddenObject(); 
                        this.uiChild.enter(this);  
                        this.uiChild.update();
                    } 
                    else{ 
                        this.uiChild = new constructors.Primitive(); 
                        this.uiChild.enter(this);  
                        this.uiChild.update();
                    } 
                }) 
            } 
            this.ref.value.on.update = function(){ 
                this.selection.each(function(d, i){ 
                    if (typeof d.value == "function"){
						if (this.uiChild instanceof constructors.Function){
                            this.uiChild.update();
						}
						else{
							this.uiChild.exit(); 
                            this.uiChild = new HiddenObject(); 
                            this.uiChild.enter(this); 
                            this.uiChild.update();
                            d3.select(this.parentNode).select(arrowNode.selector).html(ui.symbols.utf8.arrow.right); 
						}
					}
					else if (d.value instanceof Object){
                        if (this.uiChild instanceof constructors.Primitive || this.uiChild instanceof constructors.Function){
                            this.uiChild.exit(); 
                            this.uiChild = new HiddenObject(); 
                            this.uiChild.enter(this); 
                            this.uiChild.update();
                            d3.select(this.parentNode).select(arrowNode.selector).html(ui.symbols.utf8.arrow.right); 
                        }
                        else if (this.uiChild instanceof HiddenObject){
                            this.uiChild.update(); 
                        }
						else{
							if (d.value instanceof Array && !(this.uiChild instanceof constructors.Array)){
								this.uiChild.exit(); 
								this.uiChild = new constructors.Array(config);
								this.uiChild.enter(this); 
								this.uiChild.update();
							}
							else if (!(this.uiChild instanceof constructors.Object)){
								this.uiChild.exit(); 
								this.uiChild = new constructors.Object(config);
								this.uiChild.enter(this); 
								this.uiChild.update();
							}
							else {
								this.uiChild.update();
							}
						}
                    } 
                    else{ 
                        if (this.uiChild instanceof constructors.Primitive){
                            this.uiChild.update();
                        }
                        else{ 
                            this.uiChild.exit(); 
                            this.uiChild = new constructors.Primitive(); 
                            this.uiChild.enter(this);
                            this.uiChild.update(); 
                        } 
                    } 
                }) 
            } 
        } 
        function HiddenObject(config){
            config || (config = {});
            var data = config.data; 
            ui.Template.call(this, {factory:"HiddenObject"}); 
            this.elements.content = new ui.Node({node:"span", ref:"content"}); 
            this.updateRef(); 
            this.ref.content.update.html = function(d) { return "..." }; 
            var baseUpdate = this.update; 
            this.update = function(config){ 
				config || (config = {});
                data = config.data; 
                baseUpdate.call(this); 
            }; 
        } 
        function Primitive(config){ 
            config || (config = {});
            var data = config.data; 
            ui.Template.call(this, {factory:"Primitive"}); 
            this.elements.value = new ui.Node({node:"span", ref:"value"}); 
            this.elements.value.update.html = function(d) { return d.value }; 
            this.updateRef(); 
            var baseUpdate = this.update; 
            this.update = function(config){
				config || (config = {});
                data = config.data; 
                baseUpdate.call(this); 
            }; 
        }
        
		function FunctionListing(config){
            var mirrowConfig = {
                lineNumbers:true,
				readOnly:true,
                mode:"javascript"
            };
            ui.templates.ReqursiveObject.call(this, config);
			var listing = new ui.Node({ref:"listing"});
			this.elements.listing = listing;
			this.updateRef();
			listing.on.enter = function(){
                this.entered.each(createMirrow)
            }
            listing.on.update = function(){
                this.selection.each(function(d, i){
                    
                })
            }
            listing.on.exit = function(){
                this.exited.each(function(d, i){
                    
                })
            }
			function createMirrow(d, i){
                var inputNode = d3.select(this);
                inputNode.html("");
                var textarea = inputNode.append("textarea").node();
                var uiEditor = codemirror.fromTextArea(textarea, mirrowConfig);
                uiEditor.setValue(d.value.toString());
                inputNode.uiEditor = uiEditor;
            }
		}
		
        this.ObjectEditor = ObjectEditor;
        /**
         * Редактор объекта
         @constructor
        */
        function ObjectEditor(config){
            config = config || {};
            config.constructors = {
                Object:ObjectEditor,
                Array:ArrayEditor
            };
            config.factory = "ObjectEditor";
            ui.templates.ReqursiveObject.call(this, config);
            var self = this;
            var wrap = this.ref.wrap;
            var fields = wrap.childs.fields;
            var remove = new ui.Node({node:"span"});
            remove.enter.attr.class = "lui-button";
            remove.enter.on.click = removeField;
            fields.childs.remove = remove;
            var editor = new ui.Node();
            this.elements.setBefore("wrap", "editor", editor);
            
            editor.on.enter = function(){
                this.entered.each(function(d, i){
                    var uiEditor = new DataEditorWrap();
                    uiEditor.enter(this);
                    this.uiEditor = uiEditor;
                })
            }
            editor.on.update = function(){
                this.selection.each(function(d, i){
                    this.uiEditor.update();
                })
            }
            editor.on.exit = function(){
                this.exited.each(function(d, i){
                    delete this.uiEditor;
                })
            }
            function removeField(d, i){
                var fieldsDom = this.parentNode;
                var wrapDom = fieldsDom.parentNode;
                var editorNode = d3.select(wrapDom.parentNode).select(editor.selector);
                var editorDom = d3.select(wrapDom.parentNode).select(editor.selector).node();
                var editorData = editorNode.data()[0];
                
                var uiEditor = editorDom.uiEditor;
                if (editorData.value instanceof Array){
                    var copy = [].concat(editorData.value);
                    copy.splice(d.key, 1);
                }
                else {
                    var copy = ui.utils.extend.call({}, editorData.value);
                    delete copy[d.key];
                }
                uiEditor.saveData(editorData, copy);
            }
            function DataEditorWrap(){
                DataEditor.call(this, {
                    factory:"DataEditor"
                });
                this.on("enter", function(){
                    wrap.selection.style("display", "none");
                })
                this.on("edit", function(){
                    self.update();
                })
                this.on("exit", function(){
                    wrap.selection.style("display", "block");
                })
            }
        }
        function ToolNode(config){
            config = config || {};
            var tools = config.tools || [];
            ui.Node.call(this, {
                node:"div"
            })
            var self = this;
            tools.forEach(function(d, i){
                self.childs[d] = new ui.Node({node:"span", ref:"tools." + d});
                self.childs[d].enter.attr.class = "lui-button";
            });
        }
        function DataEditor(config){
            config = config || {};
            var metaField = config.metaField || "__editor__";
            ui.Template.call(this, {
                factory:config.factory || "DataEditor"
            })
            var dispatch = d3.dispatch("enter", "exit", "edit");
            this.on = dispatch.on.bind(dispatch);

            var mirrowConfig = {
                lineNumbers:true,
                mode:"json"
            };
            var self = this;
            var editorTools = new ToolNode({
                tools:["edit", "copy", "upload", "prev", "next"]
            });
            var mirrowTools = new ToolNode({
                tools:["parse", "cancel"]
            });
            var input = new ui.Node();
            var wrap = new ui.Node();
            this.elements.wrap = wrap;
            this.elements.wrap.childs.editorTools = editorTools;
            this.elements.wrap.childs.mirrowTools = mirrowTools;
            this.elements.wrap.childs.input = input;
            this.updateRef();
            wrap.enter = createMeta;
            mirrowTools.childs.parse.enter.on.click = parseMirrow;
            mirrowTools.childs.cancel.enter.on.click = removeMirrow;
            mirrowTools.enter.style.display = "none";
            
            
            editorTools.childs.copy.enter.on.click = saveToClipboard;
            editorTools.childs.upload.enter.on.click = saveToJson;
            editorTools.childs.edit.enter.on.click = createMirrow;
            editorTools.childs.prev.update.style.display = function(d){
                return getMeta(d).currentCopy > 0?"inline":"none";
            }
            editorTools.childs.prev.enter.on.click = prevCopy;
            editorTools.childs.next.enter.on.click = nextCopy;
            
            editorTools.childs.next.update.style.display = function(d){
                return getMeta(d).currentCopy < getMeta(d).history.length - 1?"inline":"none";
            }
            
            input.on.update = function(){
                this.selection.each(function(d, i){
                    var wrapDom = this.parentNode;
                    if (wrapDom.uiEditor)
                        wrapDom.uiEditor.setValue(JSON.stringify(d.value, null, 4));
                })
            }
            input.on.exit = function(){
                this.exited.each(function(d, i){
                    var wrapDom = this.parentNode.parentNode;
                    delete wrapDom.uiEditor;
                })
            }
            this.saveData = saveData;
            function saveToJson(d, i){
                ui.utils.savers.json({
                    filename:d.key+".json",
                    data:d.value
                });
            }
            function saveToClipboard(d, i){
                ui.utils.savers.clipboard(JSON.stringify(d.value, null, 4));
            }
            function createMirrow(d, i){
                editorTools.selection.style("display", "none");
                mirrowTools.selection.style("display", "block");
                var wrapDom = this.parentNode.parentNode;
                var inputNode = d3.select(wrapDom).select(input.selector);
                inputNode.html("");
                var textarea = inputNode.append("textarea").node();
                var uiEditor = codemirror.fromTextArea(textarea, mirrowConfig);
                uiEditor.setValue(JSON.stringify(d.value, null, 4));
                wrapDom.uiEditor = uiEditor;
                dispatch.call("enter");
            }
            function parseMirrow(d, i){
                var wrapDom = this.parentNode.parentNode;
                var uiEditor = wrapDom.uiEditor;
                var json = uiEditor.getValue();
                var object;
                try{
                    object = JSON.parse(json);
                }
                catch(e){
                    alert(e);
                }
                if (object){
                    saveData(d, object);
                    removeMirrow.call(this);
                }
            }
            function removeMirrow(d, i){
                editorTools.selection.style("display", "block");
                mirrowTools.selection.style("display", "none");
                var wrapDom = this.parentNode.parentNode;
                var inputNode = d3.select(wrapDom).select(input.selector);
                inputNode.html("");
                delete wrapDom.editor;
                dispatch.call("exit");
            }
            function nextCopy(d, i){
                var meta = getMeta(d);
                meta.currentCopy++;
                updateNodeData(d, meta.history[meta.currentCopy]);
            }
            function prevCopy(d, i){
                var meta = getMeta(d);
                meta.currentCopy--;
                updateNodeData(d, meta.history[meta.currentCopy]);
            }
            function updateNodeData(nodeData, newData){
				if (nodeData.value instanceof Array){
					nodeData.value.splice(0, nodeData.value.length);
					newData.forEach(function(d){
						nodeData.value.push(d);
					})
				}
				else {					
					ui.utils.each.call(nodeData.value, function(d, i){
						delete nodeData.value[i];
					})
					ui.utils.extend.call(nodeData.value, newData)
                }
                dispatch.call("edit");
                self.update();
            }
            function saveData(nodeData, newData){
                var copy = ui.utils.extend.call({}, nodeData.value);
                var meta = getMeta(nodeData);
                if (meta.currentCopy != meta.history.length - 1){
                    var deleteStart = meta.currentCopy + 1;
                    var deleteCount = meta.history.length - 1 - meta.currentCopy;
                    meta.history.splice(deleteStart, deleteCount);
                }
                meta.history.push(newData);
                meta.currentCopy = meta.history.length - 1;
                
                updateNodeData(nodeData, newData);
            }
            function createMeta(d){
                var copy = ui.utils.extend.call({}, d.value);
                d[metaField] = d[metaField] || {history:[copy], currentCopy:0};
            }
            function getMeta(d){
                d[metaField] || createMeta(d);
                return d[metaField];
            }
            
        }
        this.ArrayEditor = ArrayEditor;
        function ArrayEditor(config){
            config = config || {};
            ObjectEditor.call(this, config);
        }
		function ReqursiveXml(config){ 
            config || (config = {});
            var data = config.data || {}; 
            ui.Template.call(this, {factory:"ReqursiveXml"}); 
            this.elements.wrap = new ui.Node({ref:"wrap"});  
            this.elements.wrap.childs.nodes = new ui.Node({ref:"nodes"}); 
            this.elements.wrap.childs.nodes.childs.arrow = new ui.Node({node:"span", ref:"arrow"}); 
            this.elements.wrap.childs.nodes.childs.openStart = new ui.Node({node:"span", ref:"openStart"}); 
            this.elements.wrap.childs.nodes.childs.openName = new ui.Node({node:"span", ref:"openName"});  
            this.elements.wrap.childs.nodes.childs.attributes = new ui.Node({node:"span", ref:"attributes"}); 
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute = new ui.Node({node:"span", ref:"attribute"}); 
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute.childs.attrName = new ui.Node({node:"span", ref:"attrName"}); 
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute.childs.attrSeparator = new ui.Node({node:"span", ref:"attrSeparator"});
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute.childs.openQuote = new ui.Node({node:"span", ref:"openQuote"}); 
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute.childs.attrValue = new ui.Node({node:"span", ref:"attrValue"}); 
            this.elements.wrap.childs.nodes.childs.attributes.childs.attribute.childs.closeQuote = new ui.Node({node:"span", ref:"closeQuote"}); 
            this.elements.wrap.childs.nodes.childs.openEnd = new ui.Node({node:"span", ref:"openEnd"}); 
            this.elements.wrap.childs.nodes.childs.content = new ui.Node({node:"div", ref:"content"}); 
            this.elements.wrap.childs.nodes.childs.closeStart = new ui.Node({node:"span", ref:"closeStart"}); 
            this.elements.wrap.childs.nodes.childs.closeName = new ui.Node({node:"span", ref:"closeName"});  
            this.elements.wrap.childs.nodes.childs.closeEnd = new ui.Node({node:"span", ref:"closeEnd"}); 
            this.updateRef(); 
			this.ref.nodes.data.array = function() { return data.childNodes?Array.prototype.filter.call(data.childNodes, function(d){ return d.localName&&d.localName != ""}):[] };
            this.ref.arrow.enter.html = ui.symbols.utf8.arrow.right; 
			this.ref.arrow.update.style.display = function(d, i) { return d.childNodes.length?"inline":"none" }
            this.ref.openStart.enter.html = "<";
            this.ref.openName.update.html = function(d, i) { return d.localName };
            this.ref.openEnd.enter.html = ">";
            this.ref.closeStart.enter.html = "</";
            this.ref.closeName.update.html = function(d, i) { return d.localName };
            this.ref.closeEnd.enter.html = ">";
			this.ref.attribute.data.array = function(d, i) { return d.attributes || [] };
			this.ref.attrName.update.html = function(d, i) { return d.nodeName };
			this.ref.attrSeparator.enter.html = "=";
			this.ref.openQuote.enter.html = '"';
			this.ref.attrValue.update.html = function(d, i) { return d.nodeValue };
			this.ref.closeQuote.enter.html = '"';
            var baseUpdate = this.update; 
            this.update = function(config){ 
                config || (config = {});
                data = config.data || data; 
                baseUpdate.call(this); 
            }; 
			var contentNode = this.ref.content;
            this.ref.arrow.enter.on.click = function(d, i){ 
                var contentDom = d3.select(this.parentNode).select(contentNode.selector).node(); 
				if (contentDom.uiChild instanceof HiddenXml){ 
					contentDom.uiChild.exit(); 
					contentDom.uiChild = new ReqursiveXml({data:d}); 
					contentDom.uiChild.enter(contentDom); 
					contentDom.uiChild.update({data:d});
					contentDom.style.display = "block";
					this.innerHTML = ui.symbols.utf8.arrow.down;
				} 
				else if (contentDom.uiChild instanceof ReqursiveXml){ 
					contentDom.uiChild.exit(); 
					contentDom.uiChild = new HiddenXml({data:d}); 
					contentDom.uiChild.enter(contentDom); 
					contentDom.uiChild.update({data:d.value});
					contentDom.style.display = "inline-block"; 
					this.innerHTML = ui.symbols.utf8.arrow.right;
				} 
            } 
            this.ref.content.update.style.display = function(d, i){ 
                if (this.uiChild instanceof ReqursiveXml){ 
                    return "block" 
                } 
                return "inline-block"; 
            } 
            this.ref.content.on.enter = function(){ 
                this.entered.each(function(d, i){ 
					this.uiChild = new HiddenXml({data:d}); 
					this.uiChild.enter(this); 
					this.uiChild.update({data:d});
                }) 
            } 
            this.ref.content.on.update = function(){ 
                this.selection.each(function(d, i){ 
                    this.uiChild.update({data:d})
                }) 
            } 
        } 
		function HiddenXml(config){ 
            var data = config.data || {}; 
            ui.Template.call(this, {factory:"HiddenXml"}); 
            this.elements.hidden = new ui.Node({node:"span", ref:"hidden"}); 
            this.updateRef(); 
            this.ref.hidden.update.html = function() { return data.childNodes.length?"...":data.innerHTML }; 
            var baseUpdate = this.update; 
            this.update = function(config){ 
                data = config.data || data; 
                baseUpdate.call(this); 
            }; 
        } 
        function Placeholders(){
            this.Load = uiLoad;
            function uiLoad(config){
                config || (config = {});
                var timeout;
                var animationStep = 500;
                ui.Template.call(this, {factory:config.factory || "uiLoad", module:config.module});
                var wrap = new ui.Node({node:"div"});
                wrap.enter.style.display = "table";
                wrap.enter.style.width = "100%";
                wrap.enter.style.height = "100%";
                var label = new ui.Node({node:"div"})
                label.enter.style.display = "table-cell";
                label.enter.html = "Загрузка";
                this.elements.wrap = wrap;
                this.elements.wrap.childs.label = label;
                
                var baseEnter = this.enter;
                this.enter = function(uiParentNode){
                    baseEnter.call(this, uiParentNode);
                    //timeout = setTimeout(animate, animationStep)
                }
                var baseExit = this.exit;
                this.exit = function(){
                    clearTimeout(timeout);
                    baseExit.call(this);
                }
                
                var dots = "";
                function animate(){
                    if (dots.length > 3) dots = "";
                    dots += ".";
                    label.selection.html("Загрузка" + dots);
                    timeout = setTimeout(animate, animationStep);
                }
                
            }
        }
        function AnimationTemplates(){
            this.RotatingCircles = uiRotatingCircles;
            function uiRotatingCircles(config){
                if (typeof config === "undefined") config = {};
                var self = this;
                var timeout;	
                var alpha;
                var viewport = new ui.models.Viewport;
                var circle = { radius:0 };
                var rotation = { radius:0 };
                
                // Наследуем в функциональном стиле класс ui.Template
                ui.Template.call(self, {factory:"uiRotatingCircles", module:config.module});
                // Формируем перечень параметров
                self.rotation = { duration:1000 };
                self.circle = { n:24 };
                // Формируем иерархию элементов
                self.elements.wrap = new ui.Node({node:"div"});
                self.elements.wrap.childs.group = new ui.Node({node:"div", ref:"group"});
                self.elements.wrap.childs.group.childs.circleG = new ui.Node({node:"div", ref:"circleG"});
                self.elements.wrap.childs.group.childs.circleG.childs.circle = new ui.Node({node:"div", ref:"circle"});
                // Обновляем ссылки, чтоб не продираться через childs.childs.childs
                self.updateRef();
                // Связываем узел иерархии с массивом данных
                self.ref.circleG.data.array = function() {
                    var data = [];
                    for (var i = 0; i < self.circle.n; i++) { data.push(i) }; 
                    alpha = 2*Math.PI/(self.circle.n);
                    return data
                };
                // Задаем свойства, вычисляющиеся при создании элемента
                self.ref.group.enter.style.position = "absolute";
                self.ref.circleG.enter.style.position = "absolute";
                self.elements.wrap.enter.style.position = "initial";
                self.elements.wrap.enter.style.left = 0 + px;
                self.elements.wrap.enter.style.top = 0 + px;
                self.ref.circle.enter.style = {
                    "border-radius":"100%",
                    "animation-name":"uiPulseScale",
                    "animation-duration":self.rotation.duration+"ms",
                    "animation-delay":function(d, i) { return self.rotation.duration*i/self.circle.n+"ms" },
                    "animation-timing-function":"linear",
                    "animation-iteration-count":"infinite",
                    "animation-direction":"normal",
                    "animation-fill-mode":"reverse",
                    "background-color":"orange"
                };
                
                // Задаем свойства, вычисляющиеся при обновлении элемента
                self.elements.wrap.update.style = function(){
                    //wrap находится на вершине иерархии, соответственно ее обновление будет выполнено первым, а значит тут можно обновить переменные, доступные через замыкание
                    viewport.update(this);
                    
                    var D = viewport.width>viewport.height?viewport.height:viewport.width;
                    var R = D*0.4;
                    /*
                    var k1 = Math.sin(Math.PI - alpha*0.25);
                    var k2 = Math.sin(alpha*0.5);
                    circle.radius = R * k1/(k1 + k2)*0.5;*/
                    circle.radius = Math.PI*R / self.circle.n ;
                    rotation.radius = R - circle.radius;
                    return viewport.style
                }
                self.ref.group.update.style = function() { return { left:viewport.width*0.5 + "px", top:viewport.height*0.5 + "px" } }
                self.ref.circleG.update.style = function(d, i) { return polar(rotation.radius, alpha*i) };
                self.ref.circle.update.style.width = function() {return circle.radius*1.1 + "px"};
                self.ref.circle.update.style.height = function() {return circle.radius*1.1 + "px"};
                
                function polar(r, a){
                    var x = r*Math.sin(a);
                    var y = -r*Math.cos(a);
                    return translate(x, y);
                }
                function translate(x, y){
                    return {left:x+"px", top:y+"px"};
                    //return "translate( " + x + ", " + y + ")"
                }
                
                //Расширяем функциональность метода enter, добавляем запуск анимации
                var uiEnter = self.enter;
                self.enter = function(uiParentNode){
                    uiEnter.call(self, uiParentNode);
                    self.update();
                    //animate();
                };
                //Расширяем функциональность метода exit, добавляем остановку анимации
                var uiExit = self.exit;
                self.exit = function(){
                    //clearTimeout(timeout);
                    uiExit.call(self);
                };
                var animationProp = {
                    start:{
                        attr:{
                            r:function(){ return circle.radius }
                        },
                        style:{
                            fill:function(){ return "green" }
                        }
                    },
                    end:{
                        attr:{
                            r:function (){ return 0 }
                        },
                        style:{
                            fill:function(){ return "orange" }
                        }
                    }
                }
                function animate(){
                    var duration = self.rotation.duration;
                    var popIn = duration*0.1;
                    var popOut = duration*0.5;
                    self.ref.circle.selection
                        .transition().duration(popIn).delay(function(d, i, arr) { return duration*i/self.circle.n }).applyAll(animationProp.start)
                        .transition().duration(popOut).applyAll(animationProp.end);
                    timeout = setTimeout(animate, duration);    
                }
            }
        }
        function Plot(config){
            if (typeof config === "undefined") config = {};
            var layers = config.layers || {};
            var self = this;
            ui.Template.call(self, {factory:config.factory || "Plot", module:config.module});
            self.viewport = new ui.models.Viewport();
            self.elements.layers = new ui.Node();
            ui.utils.each.call(layers, function(item, key){
                self.elements.layers.childs[key] = new ui.Node({node:item, ref:"layers."+key})
            });
            self.updateRef();
            self.elements.layers.enter.style = {                
                left:0 + px, 
                top:0 + px, 
                position:"absolute"
            }
            self.elements.layers.update.style = function(){ 
                self.viewport.update(this);
                return self.viewport.style;                    
            }
            self.ref.layers.each(function(layer){
                layer.enter.style = {                
                    left:0 + px, 
                    top:0 + px, 
                    position:"absolute"
                }   
                if (layer.node === "svg"){
                    layer.update.attr = function(){      
                        return self.viewport.attr;  
                    }
                }
                else{
                    layer.update.style = function(){           
                        return self.viewport.style;  
                    }
                    
                }
            })
        }  
        function RegularPolygon(config){
            if (typeof config === "undefined") config = {};
            if (typeof config.faceCount === "undefined") config.faceCount = 3;
            var self = this;
            var rotation = d3.dispatch("start", "end");
            self.rotation = rotation;
            var viewport = {
                width:0, 
                height:0,
                update:function(node){
                    this.width = node.parentNode.clientWidth;
                    this.height = node.parentNode.clientHeight;
                }
            };
            ui.Template.call(self, {factory:"RegularPolygon", module:config.module});
            var polygon = new PolygonModel(config.faceCount);
            self.model = polygon;

            self.elements.wrap = new ui.Node({ref:"wrap"});
            self.elements.wrap.childs.faces = new ui.Array({ref:"faces"});
            for (var i = 0; i < config.faceCount; i++){
                self.elements.wrap.childs.faces.push(new ui.Node());
            }
            self.updateRef();
            
            self.ref.wrap.enter.style = function(){
                var style = updateWrap.call(this);
                style.position = "absolute";
                style.left = "0px";
                style.top = "0px";
                style.perspective = "1000px";
                return style;
            }
            self.ref.wrap.update.style = updateWrap;
            
            function updateWrap(){
                viewport.update(this);
                polygon.a(viewport.width);
                return {
                    width:viewport.width + px,
                    height:viewport.height + px
                }
            }
            self.ref.faces.each(function(face, i){
                face.enter.style = function(){
                    var style = updateFace();
                    style.position = "absolute";
                    style.left = "0px";
                    style.top = "0px";
                    style.height = "100%"
                    return style;
                }
                face.update.style = updateFace;
                function updateFace(){
                    var a = polygon.alpha(i);
                    var style = polygon.style(a);
                    style.width = viewport.width + px;
                    style.height = viewport.height + px;
                    return style;
                }
            })
            self.selectFace = selectFace;
            function selectFace(i, duration){
                if (polygon.selectedFace === i) return;
                polygon.selectFace(i);
                applyRotation(duration);
            }
            function applyRotation(duration){
                isNaN(+duration) && (duration = 1000);
                rotation.call("start", polygon);
                self.ref.faces.each(function(face, i){
                    face.selection.transition().duration(duration)
                    //.ease(d3.easeLinear)
                    .tween("style.transform", function(){
                        //определяем начальную и конечную точку поворота
                        var start = polygon.alpha(i + polygon.prevOffset);
                        var end = polygon.alpha(i + polygon.currOffset);
                        //расчитываем разницу и обределяем в какую сторону будем крутить
                        var delta = end - start;
                        var invertDelta = delta + Math.PI*2*(delta<0?1:-1);
                        //если в противоположную сторону крутить короче, то пересчитываем конечную точку
                        if (Math.abs(delta) > Math.abs(invertDelta)) end = start + invertDelta;
                        
                        var itr = d3.interpolateNumber(start, end);
                        return function(t){
                            var style = polygon.style(itr(t))
                            face.selection.apply("style", style);
                        }
                    }).on("end", function(){ rotation.call("end", polygon); });
                });
            }
            function PolygonModel(n){ // модель правильного многогранника, где n - число граней
                var alphaStep = Math.PI/n, //угловой размер грани 
                    sin = Math.sin(alphaStep),
                    cos = Math.cos(alphaStep),
                    R = 0,  //радиус описанной окружности
                    a = 0,  //ширина грани
                    r = 0;  //расстояние от центра до грани
                this.prevOffset = 0;
                this.currOffset = 0;
                this.a = function(value){ 
                    if (value){
                        a = value;
                        R = a/(2*sin);
                        
                        r = R*cos;
                        return this;
                    }
                    else{
                        return a;
                    }
                }
                this.alpha = function(i){
                    return (i)*alphaStep*2;
                }
                this.selectedFace = 0;
                this.selectFace = function(i) { 
                    this.prevOffset = this.currOffset;
                    this.currOffset = n - i; 
                    this.selectedFace = i;
                }
                this.style = function(a){
                    var style = {};      
                    var alpha = a%(Math.PI*2);
                    style["z-index"] = Math.floor((Math.abs(alpha)<Math.PI?(Math.PI - Math.abs(alpha)):(Math.abs(alpha) - Math.PI))*100);
                    style.transform = "translate3d(0, 0, -"+r+"px)rotate3d(0, 1, 0, "+a+"rad)translate3d(0, 0, "+r+"px)";
                    return style;
                }
            }
        }
        function Tooltip(config){
            var self = this;
            var showDelay = 500;
            var hideDelay = 100;
            var showTimeout;
            var hideTimeout;
            var x, y, d;
            var target = config.target;
            ui.Template.call(this, {factory:"Tooltip", module:config.module});
            this.elements.content = new ui.Node({ref:"content"});
            this.updateRef();
            this.ref.content.enter.style.position = "absolute";
            this.ref.content.enter.style.left = function() { return x + "px" };
            this.ref.content.enter.style.top = function() { return y + "px" };
            this.ref.content.data.array = function() { return [d] };
            this.ref.content.enter.on.mouseenter = cancelHide;
            this.ref.content.enter.on.mouseleave = hide;
            var enter = this.enter.bind(this);
            var exit = this.exit.bind(this);
            delete this.enter;
            delete this.exit;
            this.show = show;
            this.hide = hide;
            function spawn(event){
                exit();
                if (hideTimeout)clearTimeout(hideTimeout);
                
                x = event.x;
                y = event.y;
                d = event.d;
                if (showTimeout) clearTimeout(showTimeout);
                showTimeout = setTimeout(function(){
                    enter(document.body);
                }, showDelay);
            }
            function show(d, i, arr){
                var accessor;
                if (typeof d === "function"){
                    accessor = d;
                    return function(d, i, arr){
                        spawn({
                            x:event.pageX, 
                            y:event.pageY, 
                            d:accessor(d)
                        })
                    }
                }
                else{
                    spawn({
                        x:event.pageX, 
                        y:event.pageY, 
                        d:d
                    })
                }
            }
            function hide(){
                if (showTimeout) clearTimeout(showTimeout);
                if (hideTimeout) clearTimeout(hideTimeout);
                hideTimeout = setTimeout(function(){
                    if (showTimeout) clearTimeout(showTimeout);
                    exit();
                }, hideDelay);     
            }
            function cancelHide(){
                if (hideTimeout) clearTimeout(hideTimeout);
            }
        }
        function uiGrid(config){
            var self = this;
            var cellCount = config.cellCount;
            var cellsSelection;
            var cell = {width:0, height:0};
            var viewport = {width:0, height:0};
            ui.Template.call(this, {factory:"Grid", module:config.module});
            this.config = {};
            this.config.cell = {};
            this.config.cell.minWidth = 390;
            this.config.cell.minHeight = 250;
            
            this.elements.wrap = new ui.Node({ref:"wrap"});
            this.elements.wrap.childs.grid = new ui.Node({ref:"grid"});
            this.elements.wrap.childs.grid.childs.cells = new ui.Array({ref:"cells"});
            for (var i = 0; i < cellCount; i++){
                this.elements.wrap.childs.grid.childs.cells.push(new ui.Node());
                this.elements.wrap.childs.grid.childs.cells[i].enter.style.position = "absolute";
            }
            this.updateRef();
            this.ref.wrap.enter.on.scroll = ui.events.disableEvents;
            this.ref.wrap.enter.style = {
                position:"relative",
                left:0 + px,
                top:0 + px,
                "overflow-x":"hidden"
            }
            this.ref.grid.enter.style = {
                position:"absolute",
                left:0 + px,
                top:0 + px
            }
            /*
            self.ref.wrap.enter.on.scroll = function(){
                culling();
            }*/
            this.ref.wrap.update.style = function(){
                viewport.width = this.parentNode.clientWidth;
                viewport.height = this.parentNode.clientHeight;
                viewport.n = Math.floor( viewport.width / self.config.cell.minWidth );   //число столбцов
                if (viewport.n > 3) viewport.n = 3;
                viewport.m = Math.floor( viewport.height / self.config.cell.minHeight ); //число строк
                cell.width = viewport.width / viewport.n; 
                cell.height = viewport.height / viewport.m; 
                var overflow = cellCount > viewport.n * viewport.m;
                return {
                    width:viewport.width + px,
                    height:viewport.height + px,
                    "overflow-y":overflow?"scroll":"hidden"
                }
            }
            this.ref.grid.update.style = function(){ 
                var height = this.parentNode.clientHeight / viewport.m;
                var k = Math.ceil(cellCount / viewport.n);    
                cell.width = this.parentNode.clientWidth / viewport.n; 
                cell.height = this.parentNode.clientHeight / viewport.m;             
                return {
                    width:this.parentNode.clientWidth + px,
                    height:height*k + px
                }
            }
            this.ref.cells.each(function(item, index){
                item.update.style = function(){
                    var n = viewport.n;
                    var m = viewport.m;
                    var i = Math.floor( index / n );    //номер строки
                    var j = index % n;	                //номер столбца
                    var width = cell.width;     
                    var height = cell.height; 
                    var left = width * j;
                    var top = height * i;
                    var style = {}; 
                    style.left = left + 5 + px;
                    style.top = top + 5 + px;
                    style.width = width - 10 + px;
                    style.height = height - 10 + px;
                    return style;
                }
            })
            
            var uiEnter = this.enter;
            this.enter = function(uiParentNode){
                cell.array = [];
                uiEnter.call(this, uiParentNode);
                //cellsSelection = self.ref.grid.selection.selectAll("[d3ui-id='"+self.ref.grid.id+"'] > [d3ui-node='cells']");
                //culling();
            }
            function culling(){
                if (cellsSelection == undefined) return;
                cellsSelection.style("display", function(d, i){
                    var scrollTop = this.parentNode.parentNode.scrollTop;
                    var scrollHeight = this.parentNode.parentNode.scrollHeight;
                    var parentHeight = this.parentNode.parentNode.clientHeight;
                    var offsetTop = this.offsetTop;
                    var offsetHeight = this.offsetHeight;
                    var display = "block";
                    if (scrollTop > offsetTop + offsetHeight) display = "none";
                    if (scrollTop + parentHeight < offsetTop) display = "none";
                    return display;
                });
            }
        }
        function uiCalendarPanel(config) {
            config || (config = {});
            var self = this;
            var dispatch = d3.dispatch("setdate","settype");
            var calendar;
            var currentType;
            var types = [
                {
                    label:'Неделя',
                    onclick: uiCalendarWeek,
                    state:{
                        start:moment().add(-1,'week').startOf('week'),
                        end:moment().add(-1,'week').endOf('week')
                    },
                    dmType:"1"
                },
                {
                    label:'Месяц',
                    onclick: uiCalendarMonth,
                    state:{
                        start:moment().add(-1,'month').startOf('month'),
                        end:moment().add(-1,'month').endOf('month')
                    },
                    dmType:"2"
                },
                {
                    label:'Квартал',
                    onclick: uiCalendarQuarter,
                    state:{
                        start:moment().add(-1,'quarter').startOf('quarter'),
                        end:moment().add(-1,'quarter').endOf('quarter')
                    },
                    dmType:"3"
                }/*,
                {
                    label:'Свободный',
                    onclick: uiCalendarDateRange,
                    state:{
                        start:moment().add(-1,'month').startOf('month'),
                        end:moment().add(-1,'month').endOf('month')
                    },
                    dmType:"*"
                }*/
            ];
            var typeMap = {
                "1":0,
                "2":1,
                "3":2,
                "*":3
            }
            
            var panel = new  ui.Template({factory: "uiCalendarPanel", module:config.module});
            panel.elements.panel = new ui.Node( {ref:'panel'} );
            panel.elements.panel.childs.switch = new ui.Node( {ref:'switch'} );
            panel.elements.panel.childs.switch.childs.button = new ui.Node( {node:'button', ref:'reportType'} );
            panel.elements.panel.childs.button = new ui.Node( {ref:'reportPeriod'} );
            panel.updateRef();
            panel.ref.switch.enter.attr.class = 'lui-buttongroup';
            panel.ref.reportType.enter.attr.class = 'lui-button lui-buttongroup__button';
            panel.ref.reportType.data.array = types;

            panel.ref.reportType.enter.html = function(d,i){ return d.label };
            panel.ref.reportType.update.classed.selected = function(d, i) { return i === currentType };
            panel.ref.reportType.enter.on.click = installCalendar;
            self.on = dispatch.on.bind(dispatch);
            self.enter = enter;
            self.exit = exit;
            self.setDateRange = setDateRange;
            self.setReportType = setReportType;
            function enter(uiParentNode){
                panel.enter(uiParentNode);
                panel.update();
                installCalendar(types[0], 0);
            }
            function exit(){
                panel.exit();
                calendar.exit();
            }
            function installCalendar(d, i){
                if (currentType === i) return;
                currentType = i;
                panel.update();
                
                if(calendar) calendar.exit();
                calendar = new d.onclick(config);
                calendar.enter(panel.ref.reportPeriod);
                calendar.on("change", function(){
                    dispatch.call("setdate", this);
                });
                dispatch.call("settype", d);
                setDateRange(d.state.start, d.state.end);
                
               // dispatch.call("settype", {start:calendar.getDate.start, end:calendar.getDate.end});
            }

            function setReportType(type, start, end){
                var i = typeMap[type];
                types[i].state.start = start;
                types[i].state.end = end;
            	installCalendar(types[i], i);
                setDateRange(start, end);
            }

            function setDateRange(start, end) {
                calendar.setDateRange(start, end);
            }
        };
        function uiCalendarDateRange(config) {
            config || (config = {})
            var currDate = moment();
            var prevDate = moment(currDate).add(-1, "M");
            var dispatch = d3.dispatch("change");
            var start = moment(currDate).startOf('month');
            var end = moment(currDate).endOf('month');
            
            var calendarButton = new ui.templates.DropButton({module:config.module});
            calendarButton.ref.label.update.html = function(){ 
                var str = end == null ? '...' : moment(end).format('DD.MM.YYYY');
                return moment(start).format('DD.MM.YYYY') + " &#8212 " + str;
            };
            calendarButton.ref.icon.update.attr.class = function(){ return calendarButton.getDisplay() ? 'lui-icon lui-icon--triangle-top' : 'lui-icon lui-icon--triangle-bottom'};
            
            var layout = new ui.Template({factory:"uiCalendarDateRange", module:config.module});
            layout.elements.container = new ui.Node( {ref:'container'} );
            layout.elements.container.childs.left = new ui.Node( {ref:'left'} );
            layout.elements.container.childs.right = new ui.Node( {ref:'right'} );
            layout.updateRef();           
            layout.ref.left.enter.style = {
                'background-color': '#fff',
                'display': 'inline-block',
                'padding': '4px 12px 4px 4px'
            };
            layout.ref.right.enter.style = {
                'background-color': '#fff',
                'display': 'inline-block',
                'padding': '4px'
            };

            var left = new uiCalendarTable({module:config.module});

            left.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            left.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            left.ref.year.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            left.ref.year.cells[0].enter.on.click = clickLeftYear;
            left.ref.year.cells[1].enter.on.click = clickLeftYear;
            left.ref.year.cells[1].update.html = function() { return prevDate.format("YYYY") };
            left.ref.year.cells[1].enter.attr.colspan = 6;

            left.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            left.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            left.ref.month.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            left.ref.month.cells[0].enter.on.click = clickLeftMonth;
            left.ref.month.cells[1].enter.on.click = clickLeftMonth;
            left.ref.month.cells[1].update.html = function() { return prevDate.format("MMMM") };
            left.ref.month.cells[1].enter.attr.colspan = 6;
            
            left.ref.weeks.data.array = function(){ return getWeeks(prevDate) };
            left.ref.days.enter.on.click = setDate;
            left.ref.days.data.array = function(d, i){ return getWeekDays(d) };
            left.ref.days.update.html = function(d, i) { return moment(d).format('D') };
            left.ref.days.update.style.color = function(d, i) { return moment(d).format('M') != prevDate.format('M') ? '#999' : '#000' };
            left.ref.days.update.classed.selected = function(d, i) { return (+d == +start || +d == +end) && moment(d).format('M') != currDate.format('M') };
            left.ref.days.update.classed.between = function(d, i) { return moment(d).isAfter(start) && moment(d).isBefore(end) && moment(d).format('M') != currDate.format('M') };
            
            var right = new uiCalendarTable({module:config.module});

            right.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            right.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            right.ref.year.cells[0].enter.on.click = clickRightYear;
            right.ref.year.cells[0].update.html = function() { return currDate.format("YYYY") };
            right.ref.year.cells[0].enter.attr.colspan = 6;
            right.ref.year.cells[1].enter.attr.class = "lui-icon lui-icon--triangle-right";
            right.ref.year.cells[1].enter.on.click = clickRightYear;

            right.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            right.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            right.ref.month.cells[0].enter.on.click = clickRightMonth;
            right.ref.month.cells[0].update.html = function() { return currDate.format("MMMM") };
            right.ref.month.cells[0].enter.attr.colspan = 6;
            right.ref.month.cells[1].enter.attr.class = "lui-icon lui-icon--triangle-right";
            right.ref.month.cells[1].enter.on.click = clickRightMonth;
            
            right.ref.weeks.data.array = function(){ return getWeeks(currDate)};
            right.ref.days.enter.on.click = setDate;
            right.ref.days.data.array = function(d, i){ return getWeekDays(d)};
            right.ref.days.update.html = function(d, i) { return moment(d).format('D') };
            right.ref.days.update.style.color = function(d, i) { return moment(d).format('M') != currDate.format('M') ? '#999' : '#000' };
            right.ref.days.update.classed.selected = function(d,i){ return (+d == +start || +d == +end) && moment(d).format('M') != prevDate.format('M') };
            right.ref.days.update.classed.between = function(d,i){ return moment(d).isAfter(start) && moment(d).isBefore(end) && moment(d).format('M') != prevDate.format('M') };
            
            this.on = dispatch.on.bind(dispatch);
            this.enter = enter;
            this.exit = exit;
            this.setDateRange = setDateRange;

            function setDateRange(_start, _end){
                start = moment(_start).startOf('day');
                end = moment(_end).startOf('day');
                calendarButton.update();
            }
            function enter(uiParentNode){
                calendarButton.enter(uiParentNode);
                calendarButton.update();
                layout.enter(calendarButton.ref.drop);        
                left.enter(layout.ref.left);
                left.update();      
                right.enter(layout.ref.right); 
                right.update();
            }
            function exit(){
                right.exit();
                left.exit();
                layout.exit();
                calendarButton.exit();
            }
            function clickLeftYear(){
                currDate = moment(currDate).add(-1, "Y");
                prevDate = moment(currDate).add(-1, "M");
                layout.update();
                right.update();
                left.update();   
            }
            function clickRightYear(){
                currDate = moment(currDate).add(1, "Y");
                prevDate = moment(currDate).add(-1, "M");
                layout.update();
                right.update();
                left.update();   
            }
            function clickLeftMonth(){
                currDate = moment(currDate).add(-1, "M");
                prevDate = moment(currDate).add(-1, "M");
                layout.update();
                right.update();
                left.update();   
            }
            function clickRightMonth(){
                currDate = moment(currDate).add(1, "M");
                prevDate = moment(currDate).add(-1, "M");
                layout.update();
                right.update();
                left.update();   
            }
            function getWeeks(date){
                var monthBegin=moment(date).startOf('month');
                var monthEnd=moment(date).endOf('month');
                var diff = 6;
                var weeks = [];
                for(var i = 0; i < diff; i++ ){
                    weeks.push(moment(monthBegin).add(i, "w"));
                }
                return weeks;
            }
            function getWeekDays(date){
                var weekBegin=moment(date).startOf('week');
                var weekEnd=moment(date).endOf('week');
                var diff = weekEnd.diff(weekBegin, "days");
                var days = [];
                for(var i = 0; i <= diff; i++ ){
                    days.push(moment(weekBegin).add(i, "d"));
                }
                return days;
            }
            function setDate(d){
                if ( (start == null && end == null) || (start != null && moment(start).isAfter(d)) || (start != null && end != null) ) {
                    clear();
                    start = d;
                } else if ( (start != null && moment(start).isBefore(d)) ){
                    end = d;
                    dispatch.call("change", {start:start, end:end});
                } else {
                    end = moment(start).add(1,'day');
                    dispatch.call("change", {start:start, end:end});
                }
                calendarButton.update();
                layout.update();
                right.update();
                left.update();   
            }
            function clear(){
                start = null;
                end = null;
            }
            function uiCellNode(nodeDef){
                ui.Node.call(this, nodeDef);
                this.enter.style = {
                    'text-align' : 'center'
                };
            }
        };
        function uiCalendarMonth(config){
            config || (config = {});
            var currDate = moment();
            var dispatch = d3.dispatch("change");
            var start = moment(currDate).startOf('month');
            var end = moment(currDate).endOf('month');
            
            var calendarButton = new DropButton({module:config.module});
            calendarButton.ref.label.update.html = function(){ return moment(start).format('YYYY MMMM'); };
            calendarButton.ref.icon.update.attr.class = function(){ return calendarButton.getDisplay() ? 'lui-icon lui-icon--triangle-top' : 'lui-icon lui-icon--triangle-bottom'};

            var menu = new uiMonthTable({module:config.module});

            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            menu.ref.year.cells[0].enter.on.click = clickLeftYear;
            menu.ref.year.cells[1].update.html = function() { return currDate.format("YYYY") };
            menu.ref.year.cells[2].enter.attr.class = "lui-icon lui-icon--triangle-right";
            menu.ref.year.cells[2].enter.on.click = clickRightYear;
           
            menu.ref.quarters.data.array = function(){ return getQuarters(currDate) };
            menu.ref.months.enter.on.click = function(d,i){
                setDate(d);
                calendarButton.hide();  
            }
            menu.ref.months.data.array = function(d, i){ return getMonths(d) };
            menu.ref.months.update.html = function(d, i) { return moment(d).format('MMM') };
            menu.ref.months.update.classed.selected = function(d, i) { return +d == +start };
            this.on = dispatch.on.bind(dispatch);
            this.enter = enter;
            this.exit = exit;
            this.setDateRange = setDateRange;
            function enter(uiParentNode){
                calendarButton.enter(uiParentNode);
                calendarButton.update();       
                menu.enter(calendarButton.ref.drop);
                menu.update();
            }
            function exit(){
                menu.exit();
                calendarButton.exit();
            }
            function setDate(d){
                start = moment(d).startOf('month');
                end = moment(d).endOf('month');
                currDate = start;
                dispatch.call("change", {start:start, end:end});
                calendarButton.update();
                menu.update();
            }
            function clickLeftYear(){
                currDate = moment(currDate).add(-1, "Y");
                calendarButton.update();
                menu.update();
            }
            function clickRightYear(){
                currDate = moment(currDate).add(1, "Y");
                calendarButton.update();
                menu.update();
            }

            function getQuarters(date){
                var begin = moment(date).startOf('year');
                var end = moment(date).endOf('year');
                var diff = end.diff(begin, "quarters");
                var quarters = [];
                for(var i = 0; i <= diff; i++ ){
                    quarters.push(moment(begin).add(i, "quarter"));
                }
                return quarters;
            }

            function getMonths(date){
                var begin = moment(date).startOf('quarter');
                var end = moment(date).endOf('quarter');
                var diff = end.diff(begin, "months");
                var months = [];
                for(var i = 0; i <= diff; i++ ){
                    months.push(moment(begin).add(i, "month"));                    
                }
                return months;
            }

            function setDateRange(_start, _end){
                start = moment(_start).startOf('day');
                end = moment(_end).startOf('day');
                currDate = start;
                calendarButton.update();
                menu.update();
            }
            function uiCellNode(nodeDef){
                ui.Node.call(this, nodeDef);
                this.enter.style = {
                    'text-align' : 'center'
                };
            }
        };
        function uiCalendarQuarter(config){
            config || (config = {})
            var currDate = moment();
            var dispatch = d3.dispatch("change");
            var start = moment(currDate).startOf('quarter');
            var end = moment(currDate).endOf('quarter');
            
            var calendarButton = new ui.templates.DropButton({module:config.module});
            calendarButton.ref.label.update.html = function(){ return moment(start).format('YYYY') + ' Q' + moment(start).format('Q'); };
            calendarButton.ref.icon.update.attr.class = function(){ return calendarButton.getDisplay() ? 'lui-icon lui-icon--triangle-top' : 'lui-icon lui-icon--triangle-bottom'};

            var menu = new uiQuarterTable({module:config.module});

            menu.ref.year.TD.enter.attr.colspan = 2;
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            menu.ref.year.cells[0].enter.on.click = clickLeftYear;
            menu.ref.year.cells[1].update.html = function() { return currDate.format("YYYY") };
            menu.ref.year.cells[2].enter.attr.class = "lui-icon lui-icon--triangle-right";
            menu.ref.year.cells[2].enter.on.click = clickRightYear;

            menu.ref.halfYears.data.array = function(){ return getHalfYear(currDate) };
            menu.ref.quarters.enter.on.click = function(d,i){
                setDate(d);
                calendarButton.hide();  
            }
            menu.ref.quarters.data.array = function(d, i){ return getQuarters(d) };
            menu.ref.quarters.update.html = function(d, i) { return 'Q' + moment(d).format('Q')};
            menu.ref.quarters.update.classed.selected = function(d, i) { return +d == +start };
            
            this.on = dispatch.on.bind(dispatch);
            this.enter = enter;
            this.exit = exit;
            this.setDateRange = setDateRange;

            function enter(uiParentNode){
                calendarButton.enter(uiParentNode);
                calendarButton.update();        
                menu.enter(calendarButton.ref.drop);
                menu.update();
            }
            function exit(){
                menu.exit();
                calendarButton.exit();
            }
            function setDate(d){
                start = moment(d).startOf('quarter');
                end = moment(d).endOf('quarter');
                currDate = start;
                dispatch.call("change", {start:start, end:end});
                calendarButton.update( );
                menu.update();
            }
            function clickLeftYear(){
                currDate = moment(currDate).add(-1, "Y");
                menu.update();
            }
            function clickRightYear(){
                currDate = moment(currDate).add(1, "Y");
                menu.update();
            }

            function getHalfYear(date){
                var begin = moment(date).startOf('year');
                var end = moment(date).endOf('year');
                var diff = end.diff(begin, 'quarters');
                var quarters = [];
                for(var i = 0; i <= diff; i+=2 ){
                    quarters.push(moment(begin).add(i, "quarter"));
                }
                return quarters;
            }

            function getQuarters(date){
                var begin = moment(date).startOf('quarter');
                var end = moment(date).endOf('quarter');
                var diff = end.diff(begin, 'quarters');
                var quarters = [];
                for(var i = 0; i <= 1; i++ ){
                    quarters.push(moment(begin).add(i, "quarter"));
                }
                return quarters;
            }

            function setDateRange(_start, _end){
                start = moment(_start).startOf('day');
                end = moment(_end).startOf('day');
                currDate = start;
                calendarButton.update();
                menu.update();
            }
            function uiCellNode(nodeDef){
                ui.Node.call(this, nodeDef);
                this.enter.style = {
                    'text-align' : 'center'
                };
            }
        };
        function uiCalendarWeek(config){
            config || (config = {});
            var currDate = moment().add(-1,'week');
            var dispatch = d3.dispatch("change");
            var start = moment(currDate).startOf('week');
            var end = moment(currDate).endOf('week');
            var startM = moment(currDate).startOf('month');
            var endM = moment(currDate).endOf('month');
            
            var calendarButton = new ui.templates.DropButton({module:config.module});
            calendarButton.ref.label.update.html = function(){ return moment(start).format('DD.MM.YYYY') + " &#8212 " + moment(end).format('DD.MM.YYYY'); };
            calendarButton.ref.icon.update.attr.class = function(){ return calendarButton.getDisplay() ? 'lui-icon lui-icon--triangle-top' : 'lui-icon lui-icon--triangle-bottom'};

            var layout = new ui.Template({factory:"uiCalendarWeek", module:config.module});
            layout.elements.container = new ui.Node( {ref:'container'} );
            layout.updateRef();           
            
	        layout.ref.container.enter.style = {
	            'background-color': '#fff',
	            'display': 'block',
	            'padding': '4px',
	            'box-shadow': '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)'
	        };


            var menu = new uiCalendarTable({module:config.module});

            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.year.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            menu.ref.year.cells[0].enter.on.click = clickLeftYear;
            menu.ref.year.cells[1].update.html = function() { return currDate.format("YYYY") };
            menu.ref.year.cells[1].enter.attr.colspan = 5;
            menu.ref.year.cells[2].enter.attr.class = "lui-icon lui-icon--triangle-right";
            menu.ref.year.cells[2].enter.on.click = clickRightYear;
            
            menu.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.month.cells.push(new uiCellNode( {node:'th'} ));
            menu.ref.month.cells[0].enter.attr.class = "lui-icon lui-icon--triangle-left";
            menu.ref.month.cells[0].enter.on.click = clickLeftMonth;
            menu.ref.month.cells[1].update.html = function() { return currDate.format("MMMM") };
            menu.ref.month.cells[1].enter.attr.colspan = 5;
            menu.ref.month.cells[2].enter.attr.class = "lui-icon lui-icon--triangle-right";
            menu.ref.month.cells[2].enter.on.click = clickRightMonth;
            
            menu.ref.weeks.data.array = function(){ return getWeeks(currDate) };
            menu.ref.weeks.enter.attr.class = 'weeks';
            menu.ref.days.enter.on.click = function(d, i) {
                setDate(d);
                calendarButton.hide();  
            };
            menu.ref.days.enter.attr.class = 'days';
            menu.ref.days.data.array = function(d, i){ return getWeekDays(d) };
            menu.ref.days.update.html = function(d, i) { return moment(d).format('D') };
            menu.ref.days.update.classed.selected = function(d, i) { return +d == +start || +d == +end || (moment(d).isAfter(moment(start)) && moment(d).isBefore(moment(end))) };
                    
            this.on = dispatch.on.bind(dispatch);
            this.enter = enter;
            this.exit = exit;
            this.setDateRange = setDateRange;

            function setDateRange(_start, _end){
                start = moment(_start).startOf('day');
                end = moment(_end).startOf('day');
                currDate = start;
                calendarButton.update({updateChildComponents:true});
                menu.update();
            }
            function enter(uiParentNode){
                calendarButton.enter(uiParentNode);
                calendarButton.update();
                layout.enter(calendarButton.ref.drop);
                layout.update();
                menu.enter(layout.ref.container);
                menu.update();
            }
            function exit(){
                menu.exit();
                layout.exit();
                calendarButton.exit();
            }
            function clickLeftYear(){
                currDate = moment(currDate).add(-1, "Y");
                menu.update();
            }
            function clickRightYear(){
                currDate = moment(currDate).add(1, "Y");
                menu.update();
            }
            function clickLeftMonth(){
                currDate = moment(currDate).add(-1, "M");
                menu.update();
            }
            function clickRightMonth(){
                currDate = moment(currDate).add(1, "M");
                menu.update();
            }
            function getWeeks(date){
                var monthBegin=moment(date).startOf('month');
                var monthEnd=moment(date).endOf('month');
                var diff = 5;
                var weeks = [];
                for(var i = 0; i <= diff; i++ ){
                    weeks.push(moment(monthBegin).add(i, "w"));
                }
                return weeks;
            }
            function getWeekDays(date){
                var weekBegin = moment(date).startOf('week');
                var weekEnd = moment(date).endOf('week');
                var diff = weekEnd.diff(weekBegin, "days");
                var days = [];
                for(var i = 0; i <= diff; i++ ){
                    days.push(moment(weekBegin).add(i, "d"));
                }
                return days;
            }
            function setDate(d){
                start = moment(d).startOf('week');
                end = moment(d).endOf('week');
                currDate = start;
                dispatch.call('change', {start:start, end:end});
                calendarButton.update();
            }

            function uiCellNode(nodeDef){
                ui.Node.call(this, nodeDef);
                this.enter.style = {
                    'text-align' : 'center'
                };
            }
        };
        function uiCalendarTable(config) {
            config || (config = {});
            ui.Template.call( this, {factory: "uiCalendarTable", module:config.module} );
            this.elements.table = new ui.Node( {node:'table', ref:'table'} );
            this.elements.table.childs.thead = new ui.Node( {node:'thead', ref:'thead'} );

            this.elements.table.childs.thead.childs.year = new ui.Node( {node:'tr', ref:'year.row'} );
            this.elements.table.childs.thead.childs.year.childs.cells = new ui.Array( {ref:'year.cells'} );

            this.elements.table.childs.thead.childs.month = new ui.Node( {node:'tr', ref:'month.row'} );
            this.elements.table.childs.thead.childs.month.childs.cells = new ui.Array( {ref:'month.cells'} );
            
            this.elements.table.childs.thead.childs.weekdays = new ui.Node( {node:'tr', ref:'weekdays.row'} );
            this.elements.table.childs.thead.childs.weekdays.childs.cells = new ui.Node( {node:'th', ref:'weekdays.cells'} );
            
            this.elements.table.childs.tbody = new ui.Node( {node:'tbody', ref:'tbody'} );
            this.elements.table.childs.tbody.childs.weeks = new ui.Node( {node:'tr', ref:'weeks'} );
            this.elements.table.childs.tbody.childs.weeks.childs.days = new ui.Node( {node:'td', ref:'days'} );
            this.updateRef();
            
            this.ref.table.enter.attr.class = "table";
            this.ref.weekdays.cells.data.array = getWeekDays;
            this.ref.weekdays.cells.enter.html = function(d, i) { return d };
            
            function getWeekDays(){
                var weekBegin=moment().startOf('week');
                var weekEnd=moment().endOf('week');
                var diff = weekEnd.diff(weekBegin, "days");
                var days = [];
                for(var i = 0; i <= diff; i++ ){
                    days.push(moment(weekBegin).add(i, "d").format("ddd"));
                }
                return days;
            }
        };
        function uiMonthTable(config) {
            config || (config = {});
            ui.Template.call( this, {factory: "uiMonthTable", module:config.module} );
            this.elements.table = new ui.Node( {node:'table', ref:'table'} );
            this.elements.table.childs.thead = new ui.Node( {node:'thead', ref:'thead'} );

            this.elements.table.childs.thead.childs.year = new ui.Node( {node:'tr', ref:'year.row'} );
            this.elements.table.childs.thead.childs.year.childs.cells = new ui.Array( {ref:'year.cells'} );
            
            this.elements.table.childs.tbody = new ui.Node( {node:'tbody', ref:'tbody'} );
            this.elements.table.childs.tbody.childs.quarters = new ui.Node( {node:'tr', ref:'quarters'} );
            this.elements.table.childs.tbody.childs.quarters.childs.months = new ui.Node( {node:'td', ref:'months'} );
            this.updateRef();
            
            this.ref.table.enter.attr.class = "table";
        };
        function uiQuarterTable(config) {
            config || (config = {});
            ui.Template.call( this, {factory: "uiQuarterTable", module:config.module} );
            this.elements.table = new ui.Node( {node:'table', ref:'table'} );
            this.elements.table.childs.thead = new ui.Node( {node:'thead', ref:'thead'} );

            this.elements.table.childs.thead.childs.yearTD = new ui.Node( {node:'td', ref:'year.TD'} );
            this.elements.table.childs.thead.childs.yearTD.childs.year = new ui.Node( {node:'tr', ref:'year.row'} );
            this.elements.table.childs.thead.childs.yearTD.childs.year.childs.cells = new ui.Array( {ref:'year.cells'});

            this.elements.table.childs.tbody = new ui.Node( {node:'tbody', ref:'tbody'} );
            this.elements.table.childs.tbody.childs.halfYears = new ui.Node( {node:'tr', ref:'halfYears'} );
            this.elements.table.childs.tbody.childs.halfYears.childs.quarters = new ui.Node( {node:'td', ref:'quarters'} );
            this.updateRef();
            
            this.ref.table.enter.attr.class = "table";
        };
    }  
    function uiModels(){
        this.Dimension = Dimension;
        this.Bounding = Bounding;
        this.Zoom = Zoom;
        this.Tree = Tree;
        this.LocalStorage = LocalStorage;
        this.Axis = Axis;
        this.graphs = new Graphs;
        this.Viewport = Viewport;
        this.svg = new SvgModels();
        function SvgModels(){
            this.path = new PathModels();
            function PathModels(){
                this.Line = Line;
                this.Area = Area;
                function Line(){
                    var x = new ui.models.Dimension();
                    var y = new ui.models.Dimension();
                    var generator = d3.line().x(x.calc).y(y.calc);
                    
                    Object.defineProperty(this, 'x', {
                        get:function(){ return x },
                        set:function(){ throw new Error("x is readonly") }
                    })
                    Object.defineProperty(this, 'y', {
                        get:function(){ return y },
                        set:function(){ throw new Error("y is readonly") }
                    })
                    Object.defineProperty(this, 'generator', {
                        get:function(){ return generator },
                        set:function(){ throw new Error("generator is readonly") }
                    })
                }
                function Area(){
                    var x = new ui.models.Dimension();
                    var y1 = new ui.models.Dimension();
                    var y0 = new ui.models.Dimension();
                    var generator = d3.area().x(x.calc).y1(y1.calc).y0(y0.calc);  
                    Object.defineProperty(this, 'generator', {
                        get:function(){ return generator },
                        set:function(){ throw new Error("generator is readonly") }
                    })
                     Object.defineProperty(this, 'x', {
                        get:function(){ return x },
                        set:function(){ throw new Error("x is readonly") }
                    })
                    Object.defineProperty(this, 'y1', {
                        get:function(){ return y1 },
                        set:function(){ throw new Error("y1 is readonly") }
                    })
                    Object.defineProperty(this, 'y0', {
                        get:function(){ return y0 },
                        set:function(){ throw new Error("y0 is readonly") }
                    })
                }
            }
        }
        function Graphs(){
            this.Graph = Graph;
            this.Sorter = Sorter;
            function Graph(){
                var nodes = [];
                var links = [];
                this.read = {
                    links:function(){return links},
                    nodes:function(){return nodes}
                }
                this.set = {
                    links:function(value){ links = value},
                    nodes:function(value){ nodes = value}
                }
            }
            function Sorter(config){
                var nodes = [];
                var childsAccessor = config.childs || function(d, i) { return d.childs };
                var idAccessor = config.id || function(d, i) { return i };
                var meta = config.meta || "_sorter";
                var nodeWidth = 600 || config.nodeWidth;
                var dispatch = d3.dispatch("sorted");
                this.on = dispatch.on.bind(dispatch);
                this.set = {
                    nodes:function(value){ 
                        nodes = value; 
                        setMetaData(); 
                    }
                }
                this.sort = {
                    vertical:sortV
                }
                function GraphSorterMetaData(id){
                    this.leaves = {map:d3.map(), array:[]};
                    this.branches = {map:d3.map(), array:[]};
                    this.forks = {map:d3.map(), array:[]};
                    this.childs =[];
                    this.parents =[];
                }
                function setMetaData(){
                    nodes.forEach(function(node, i){
                        node[meta] = new GraphSorterMetaData();
                        node[meta].id = idAccessor(node, i);
                    });
                    nodes.forEach(processNode);
                    function processNode(node){
                        if (node[meta].visited) return;
                        node[meta].visited = true;
                        var childs = childsAccessor(node);
                        childs.forEach(function(child){
                            node[meta].childs.push(child);
                            child[meta].parents.push(node);
                            processNode(child);
                        })
                    }
                    nodes.forEach(function(node){
                        if (node[meta].childs.length == 0 && node[meta].parents.length == 1){
                            node[meta].type = "leave";
                            var parent = node[meta].parents[0];
                            if (!parent[meta].leaves.map.has(node[meta].id)){
                                parent[meta].leaves.map.set(node[meta].id, parent[meta].leaves.array.length);
                                parent[meta].leaves.array.push(node);
                            }
                        }
                        else if (node[meta].parents.length == 1){
                            node[meta].type = "branch";
                            var parent = node[meta].parents[0];
                            if (!parent[meta].branches.map.has(node[meta].id)){
                                parent[meta].branches.map.set(node[meta].id, parent[meta].branches.array.length);
                                parent[meta].branches.array.push(node);
                            }
                        }
                        else if (node[meta].parents.length){
                            node[meta].type = "fork"; 
                            node[meta].parents.forEach(function(parent){
                                if (!parent[meta].forks.map.has(node[meta].id)){
                                    parent[meta].forks.map.set(node[meta].id, parent[meta].forks.array.length);
                                    parent[meta].forks.array.push(node);
                                }
                            })
                        }
                        else {
                            node[meta].type = "root"; 
                        }
                    });
                }
                function sortV(){
                    nodes.forEach(function(node){
                        node.y = undefined;
                        node.x = undefined;
                        node[meta].width = undefined;
                    });
                    nodes.forEach(function(node){
                        if (node[meta].width == undefined)
                            setNodeWidth(node);
                        if (node[meta].type == "root"){
                            node.x = 0;
                            node.y = 100;
                        }
                        else if (node[meta].type == "leave"){
                            if (node.x == undefined && node.y == undefined)
                                setLeaveXY(node);
                        }
                        else if (node[meta].type == "branch"){
                            if (node.x == undefined)
                                setBranchX(node);
                            if (node.y == undefined)
                                setBranchY(node);
                        }
                        else if (node[meta].type == "fork"){
                            if (node.x == undefined)
                                setForkX(node);
                            if (node.y == undefined)
                                setForkY(node);
                        }  
                        node.fx = node.x;
                        node.fy = node.y;  
                    });
                    dispatch.call("sorted");
                    function setNodeWidth(node){
                        if (node[meta].branches.array.length == 0){
                            node[meta].width = nodeWidth;
                            return;
                        }
                        node[meta].width = node[meta].branches.array.reduce(function(prev, curr) { 
                            if (curr[meta].width == undefined){
                                setNodeWidth(curr);
                            }
                            else if (curr[meta].width == 0){
                            }
                            return prev + curr[meta].width;
                        }, 0)
                    }
                    function setBranchX(node){
                        var parent = node[meta].parents[0];
                        if (parent[meta].width == undefined)
                            setNodeWidth(parent);
                        if (typeof parent.x === "undefined"){
                            if (parent[meta].type == "branch")
                                setBranchX(parent);
                            else if (parent[meta].type == "fork")
                                setForkX(parent);
                            else{
                                debugger;
                            }
                        }
                        
                        var index = parent[meta].branches.map.get(node[meta].id);
                        if (index == 0){
                            node.x = parent.x - parent[meta].width*0.5 + node[meta].width*0.5;
                        }
                        else{
                            var prev = parent[meta].branches.array[index - 1];
                            if (prev == undefined)
                                debugger;
                            if (prev.x == undefined){
                                setBranchX(prev)
                            }
                            if (node[meta].width == undefined)
                                setNodeWidth(node);
                            if (prev[meta].width == undefined)
                                setNodeWidth(prev);
                            node.x = prev.x + node[meta].width*0.5 + prev[meta].width*0.5;
                        }
                        node.fx = node.x;  
                    }
                    function setForkX(node){
                        var count = node[meta].parents.length;
                        var sum = node[meta].parents.reduce(function(prev, curr){ 
                            if (typeof curr.x === "undefined" && curr[meta].type == "branch") {
                                curr.x = "bla";
                                setBranchX(curr);
                            }
                            else if (typeof curr.x === "undefined" && curr[meta].type == "fork"){
                                curr.x = "bla bla";
                                setForkX(curr);
                            }
                            else if (typeof curr.x === "undefined"){
                                debugger;
                            }
                            if (curr.x == "bla" || curr.x == "bla bla"){
                                //цикл
                                curr.x = 0;
                            }
                            return prev + curr.x 
                        }, 0);
                        setForkY(node);
                        node.x = sum/count;
                        node.fx = node.x;
                    }
                    function setBranchY(node){
                        var maxY = node[meta].parents.reduce(function(prev, curr){ 
                            if (typeof curr.y === "undefined"){
                                if (curr[meta].type == "branch"){
                                    setBranchY(curr);
                                }
                                else if (curr[meta].type == "fork"){
                                    setForkY(curr);
                                }
                                else {
                                    debugger;
                                }
                            }
                            return prev < curr.y?curr.y:prev; 
                        }, 0);
                        node.y = maxY + 350;
                        node.fy = node.y;
                    }
                    function setForkY(node){
                        var maxY = node[meta].parents.reduce(function(prev, curr){ 
                            if (typeof curr.y === "undefined" && curr[meta].type == "branch") {
                                curr.y = "bla";
                                setBranchY(curr);
                            }
                            else if (typeof curr.y === "undefined" && curr[meta].type == "fork"){
                                curr.y = "bla bla";
                                setForkY(curr);
                            }
                            else if (typeof curr.y === "undefined"){
                                debugger;
                            }
                            if (curr.y == "bla" || curr.y == "bla bla"){
                                //цикл
                                curr.y = 0;
                            }
                            return prev < curr.y?curr.y:prev; 
                        }, 0);
                        node.y = maxY + 350;
                        node.fy = node.y;
                    }
                    function setLeaveXY(node){
                        var parent = node[meta].parents[0];
                        var count = parent[meta].leaves.array.length - 1;
                        var branchCount = parent[meta].branches.array.length;
                        var index = parent[meta].leaves.map.get(node[meta].id);
                        
                        if (typeof parent.x === "undefined"){
                            if (parent[meta].type == "branch") {
                                setBranchX(parent);
                            }
                            else if (parent[meta].type == "fork"){
                                setForkX(parent);
                            }
                        }
                        if (typeof parent.y === "undefined"){
                            if (parent[meta].type == "branch") {
                                setBranchY(parent);
                            }
                            else if (parent[meta].type == "fork"){
                                setForkY(parent);
                            }
                        }
                        if (count == 0){
                            if (branchCount == 1){
                                node.x = parent.x + nodeWidth*0.5;
                            }
                            else{
                                node.x = parent.x;
                            }
                            node.y = parent.y + 150;
                        }
                        else if (count/* < 5*/){
                            var width = nodeWidth*count;
                            node.x = parent.x + width*0.5 - width*index/count;
                            node.y = parent.y + 150;
                        }
                        else{
                            var k = 1;
                            if (parent[meta].branches.array.length == 1) k = -1;
                            node.x = parent.x + 30*Math.sin(Math.PI*2*index/count);
                            node.y = parent.y + k*30*Math.cos(Math.PI*2*index/count);
                        }
                        node.fx = node.x;
                        node.fy = node.y;
                    }
                }
            
            }
        }
        function Tree(){
            var nodes = [];
            var links = [];
            this.hierarchy = hierarchy;
            this.read = {
                links:function(){return links},
                nodes:function(){return nodes},
                isRoot:function(d, i) { return d.depth === 0 }
            }
            this.forEach = {
                links:function(func){ links.forEach(func) },
                nodes:function(func){ nodes.forEach(func) }
            }
            this.map = {
                nodes:function(func){nodes = nodes.map(func)}
            }
            this.forEach = {
                nodes:function(func){nodes.forEach(func)}
            }
            function hierarchy(root, _tree){
                var tree = _tree || d3.cluster().size([2000, 2000]);
                var hierarchy = tree(root);
                nodes = hierarchy.descendants();
                links = hierarchy.links();
            }
        }
        function Zoom(){
            var dispatch = d3.dispatch("zoomed");
            var call = d3.zoom().on("zoom", zoomed);
            var transform = {k:1, x:0, y:0};
            var self = this;
            this.call = call;
            this.on = dispatch.on.bind(dispatch);
            
            this.apply = function(event){
                return [this.unproject("x", event.x), this.unproject("y", event.y)];
            }
            this.unproject = function(dim, _value){
                var value = _value;
                if (transform){
                    value = (value - transform[dim])/transform.k;
                }
                return value;
            }
            this.project = function(dim, _value){
                var value = _value;
                if (transform){
                    value = value*transform.k + transform[dim];
                }
                return value;
            }
            this.projectX = this.project.bind(this, "x");
            this.projectY = this.project.bind(this, "y");
            this.style = function(){
                return {
					"transform-origin":"0 0",
					transform:"translate(" + transform.x + "px, " + transform.y + "px)"+"scale(" + transform.k + ")"
				};
            }
            this.attr = function(){
                return {
					transform:"translate(" + transform.x + ", " + transform.y + ")"+"scale(" + transform.k + ")"
				}					;
            }
            function zoomed(){
                transform = d3.event.transform;
                dispatch.call("zoomed");
            } 
        }
        function LocalStorage(config){
            var key = config.key || "nodeStorage";
            var saver = config.saver || function(){ return {} };
            var loader = config.loader || function(){ };
            this.save = save;
            this.load = load;
            function load(){
                var data = localStorage.getItem(key);
                var json;
                try{
                    json = JSON.parse(data);
                }
                catch(e){
                    console.log(e);
                }
                if (typeof json === "undefined") return;
                if (json === null) return;
                loader(json);
            }
            function save(){
                localStorage.setItem(key, JSON.stringify(saver()));
            }
        }
        function Dimension(){
            var accessor = function(d, i){ return 0 };
            var scale = d3.scaleLinear().domain([0, 1]).range([0, 1]);
            function calc(d, i, arr){
                var value = accessor.call(this, d, i, arr);
                var scaled = scale(value);
                return scaled;
            }
            Object.defineProperty(this, 'accessor', {
                get:function(){ return accessor },
                set:function(value){ 
                    if (typeof(value) === "function") accessor = value;
                    else throw new TypeError("accessor is not a function");
                }
            });
            Object.defineProperty(this, 'scale', {
                get:function(){ return scale },
                set:function(value){ 
                    if (typeof(value) === "function") scale = value;
                    else throw new TypeError("scale is not a function");
                }
            });
            Object.defineProperty(this, 'calc', {
                get:function(){ return calc },
                set:function(){ throw new TypeError("calc is readonly") }
            })
        }
        
        function Bounding (){
            var min = function() { return 0 };
            var max = function() { return 1 };
            Object.defineProperty(this, 'min', {
                set:function(value){ 
                    if (typeof(value) === "function") min = value;
                    else throw new TypeError("min is not a function");
                },
                get:function(){ return min },
            })
            Object.defineProperty(this, 'max', {
                set:function(value){ 
                    if (typeof(value) === "function") max = value;
                    else throw new TypeError("max is not a function");
                },
                get:function(){ return max },
            })
        }
        function Axis(axis){
            var self = this;
            var meta = {};
            ui.utils.each.call(axis, function(d, i){
                var dispatch = d3.dispatch("update");
                this.on = dispatch.on.bind(dispatch);
                var scale = d().domain([0, 1]).range([0, 1]);
                var domain =  new Bounding();
                var range =  new Bounding();
                var context = {};
                self[i] = context;
                meta[i] = 0;
                var dMin, dMax, rMin, rMax;
                function applyScale(value){
                    return scale(value);
                }
                function update(){
                    dMin = domain.min();
                    dMax = domain.max();
                    rMin = range.min();
                    rMax = range.max();
                    scale = d().domain([dMin, dMax]).range([rMin, rMax]);
                    dispatch.call("update", context);
                }
                Object.defineProperty(context, 'range', {
                    set:function(){ throw new TypeError("range is readonly") },
                    get:function(){ return range },
                })
                Object.defineProperty(context, 'domain', {
                    set:function(){ throw new TypeError("domain is readonly") },
                    get:function(){ return domain },
                })
                Object.defineProperty(context, 'scale', {
                    get:function(){ return applyScale  },
                    set:function(){ throw new TypeError("scale is readonly") }
                })
                Object.defineProperty(context, 'update', {
                    value:update
                })
                
            })
            var dispatch = d3.dispatch("update");
            this.on = dispatch.on.bind(dispatch);
            function syncAxisUpdate(axisKey){
                meta[axisKey]++;
                var min;
                ui.utils.each.call(meta, function(d, i){
                    if (typeof min === "undefined"){
                        min = d;
                    }
                    else {
                        if (d < min) min = d;
                    }
                });
                var sync = true;
                ui.utils.each.call(meta, function(d, i){
                    var delta = d - min;
                    if (delta !== 0) sync = false;
                    if (delta > 1) meta[i] = min + 1;
                });
                if (sync){
                    dispatch.call("update", self);
                }
            }
        }
        
        function Viewport(){
            var dispatch = d3.dispatch("update");
            this.on = dispatch.on.bind(dispatch);
            this.width = 0;
            this.height = 0;
            this.style = {};
            this.attr = {};
            this.update = function(node){
                this.width = getWidth(node.parentNode);
                this.height = getHeight(node.parentNode);
                this.style = {width:this.width+"px", height:this.height+"px"};
                this.attr = {width:this.width, height:this.height};
                dispatch.call("update", this);
            }
            function getWidth(node){ return node.clientWidth || getWidth(node.parentNode) }
            function getHeight(node){ return node.clientHeight || getHeight(node.parentNode) }
        }
    }
    function uiDev(){
        this.TemplateTree = TemplateTree;
        function TemplateTree(){
            /*var templateNest = new TemplateNest();
            templateNest.setRoot(document.body);*/
            var model = new TemplateNest();
            var layout = new Layout({module:"TemplateTree"});
            var updateButton = new ui.Node({node:"button"});
            updateButton.data.array = function(){ 
                return [{
                    label:"Template",
                    click:model.showTemplateLinks,
                    check:model.uiTemplates.showLinks
                },
                {
                    label:"Node",
                    click:model.showNodeLinks,
                    check:model.uiNodes.showLinks
                },
                {
                    label:"Dom",
                    click:model.showDomLinks,
                    check:model.uiDom.showLinks
                }]
            };
            updateButton.enter.on.click = function(d) { d.click(); layout.update(); };
            updateButton.enter.classed["lui-button"] = true;
            updateButton.update.classed["lui-button--success"] = function(d) { return d.check() };
            updateButton.enter.html = function(d) {  return d.label };
            layout.ref.menu.childs.button = updateButton;
            
            var context = new Context({module:"TemplateTree"});
            var dLinks = new Links({module:"TemplateTree"});
            dLinks.ref.link.data.array = model.uiDom.links;
            dLinks.ref.link.update.attr.d = function(d, i, arr){
                var path = d3.linkVertical().x(function(d, i) { return d.x+d.width*0.5 + 1 }).y(function(d, i) { return d.y+d.height*0.5 + 1 })(d, i, arr);
                var nan = path.split("NaN");
                if (nan.length > 1){
                    debugger;
                }
                return path;
            }
            dLinks.ref.link.enter.style = {
                stroke:"black",
                fill:"transparent"
            };
            model.on("update.dLinks", dLinks.update);
            var tLinks = new Links({module:"TemplateTree"});
            tLinks.ref.link.data.array = model.uiTemplates.links;
            tLinks.ref.link.update.attr.d = d3.linkVertical().x(function(d, i) { return d.x }).y(function(d, i) { return d.y+d.height*0.5 })
            tLinks.ref.link.enter.style = {
                stroke:"black",
                fill:"transparent"
            };
            model.on("update.tLinks", tLinks.update);
            var nLinks = new Links({module:"TemplateTree"});
            nLinks.ref.link.data.array = model.uiNodes.links;
            nLinks.ref.link.update.attr.d = d3.linkVertical().x(function(d, i) { return d.x }).y(function(d, i) { return d.y+d.height*0.5 })
            nLinks.ref.link.enter.style = {
                stroke:"black",
                fill:"transparent"
            };
            model.on("update.nLinks", nLinks.update);
            
          
            var tNodes = new Templates({module:"TemplateTree"});
            tNodes.ref.node.data.array = model.uiTemplates.nodes;
            tNodes.ref.node.enter.style.position = "absolute";
            tNodes.ref.factory.update.html = function(d, i){
				if (d.meta.path == ".Root.Layout.ReqursiveObject.ReqursiveObject.ReqursiveObject.ReqursiveObject.HiddenObject"){
					var a = 1;
				}
                return d.currentNode.uiTemplate.factory + " - instance count: " + d.values.length;
            }
            tNodes.ref.nest.root.update.style.display = function(d) {return d.values.length > 1?"block":"none"};
            tNodes.ref.nest.id.update.html = function(d) { 
                return "current instance: {id:" + d.currentNode.uiTemplate.id + ", i:" +d.meta.selected + "}" };
            tNodes.ref.nest.dec.enter.on.click = function(d) { d.prevNode() };
            tNodes.ref.nest.inc.enter.on.click = function(d) { 
				if (d.meta.path == ".Root.Layout.ReqursiveObject.ReqursiveObject.ReqursiveObject.ReqursiveObject.HiddenObject"){
					var a = 1;
				}
				d.nextNode() 
			};
            tNodes.ref.node.update.style.left = function(d) { return d.x - d.width*0.5 + "px" };
            tNodes.ref.node.update.style.top = function(d) { return d.y + "px" };
            tNodes.ref.node.update.style.width = function(d) { return d.width + "px"};
            tNodes.ref.node.update.style.height = function(d) { 
				if (d.meta.path == ".Root.Layout.ReqursiveObject.ReqursiveObject.ReqursiveObject.ReqursiveObject.HiddenObject"){
					var a = 1;
				}
				return d.height + "px"
			};
            model.on("update.tNodes", tNodes.update);

            var nNodes = new Nodes({module:"TemplateTree", factory:"Nodes"});
            nNodes.ref.node.data.array = model.uiNodes.nodes;
            nNodes.ref.node.enter.style.position = "absolute";
            nNodes.ref.node.update.html = function(d, i){
                return d.uiNode.key;
            }
            nNodes.ref.node.update.style.left = function(d) { return d.x - d.width*0.5 + "px"};
            nNodes.ref.node.update.style.top = function(d) { return d.y + "px" };
            nNodes.ref.node.update.style.width = function(d) { return d.width + "px"};
            nNodes.ref.node.update.style.height = function(d) { return d.height + "px"};
            model.on("update.nNodes", nNodes.update);
            
            var dNodes = new Nodes({module:"TemplateTree", factory:"Dom"});
            dNodes.ref.node.data.array = model.uiDom.nodes;
            dNodes.ref.node.enter.style.position = "absolute";
            dNodes.ref.node.enter.style["pointer-events"] = "auto";
            this.dNodes = dNodes;
            dNodes.ref.node.enter.on.mouseenter = function(d, i){
                d.element["_back"] = d.element.style["background-color"];
				d.element.style["background-color"] = "#CCCCCC";
            }
            dNodes.ref.node.enter.on.mouseleave = function(d, i){
                d.element.style["background-color"] = d.element["_back"];
                delete d.element["_back"];
            }
			/*
            var visibleNode;
            function showNode(d){
                visibleNode = {context:this, d:d};
                d.element["_back"] = d.element.style["background-color"];
                d.element["_border"] = d.element.style["border"];
                d.element["_color"] = d.element.style["color"];
                d.element["_stroke"] = d.element.style["stroke"];
                d.element["_z-index"] = d.element.style["z-index"];
                d.element.style["background-color"] = "grey";
                d.element.style["border"] = "1px solid black";
                d.element.style["stroke"] = "2px solid black";
                d.element.style["z-index"] = "10000";
                d3.select( d.element).classed("popUp1", true);
                d3.select( this).classed("popUp2", true);
                this.style["background-color"] = "grey";
               // clearZIndex(d.element.parentNode);
                //d.element.style["color"] = "white";
            }
            function hideNode(d){
                visibleNode = visibleNode.undefined;
                this.style["background-color"] = "white";
                d.element.style["border"] = d.element["_border"];
                d.element.style["background-color"] = d.element["_back"];
                d.element.style["stroke"] = d.element["_stroke"];
                d.element.style["color"] = d.element["_color"];
                d.element.style["z-index"] = d.element["_z-index"];
                this.style["z-index"] = "";
                delete d.element["_back"];
                delete d.element["_stroke"];
                delete d.element["_color"];
                delete d.element["_stroke"];
                delete d.element["_z-index"];
                d3.select( d.element).classed("popUp1", false);
                d3.select( this).classed("popUp2", false);
               // restoreZIndex(d.element.parentNode);
            }
            function clearZIndex(node){
                d3.select(node).classed("popUpParent", true);
                node.parentNode && node.parentNode.style && clearZIndex(node.parentNode);
            }
            function restoreZIndex(node){
                d3.select(node).classed("popUpParent", false);
                node.parentNode && node.parentNode.style && restoreZIndex(node.parentNode);
                
            }*/
            dNodes.ref.node.update.html = function(d, i){
                return "";
            }
            dNodes.ref.node.update.style.left = function(d) { return d.x + "px"};
            dNodes.ref.node.update.style.top = function(d) { return d.y + "px" };
            dNodes.ref.node.update.style.width = function(d) { return 10 + "px"};
            dNodes.ref.node.update.style.height = function(d) { return 10 + "px"};
            model.on("update.dNodes", dNodes.update);
            
            this.enter = function(uiParentNode){
                layout.enter(uiParentNode);  
                context.enter(layout.ref.graph);
                context.update();
                tLinks.enter(context.ref.tLinks);
                nLinks.enter(context.ref.nLinks);
                dLinks.enter(context.ref.dLinks);
                tNodes.enter(context.ref.tNodes);
                nNodes.enter(context.ref.nNodes);
                dNodes.enter(context.ref.dNodes);
                //ui.Template.on("update.TemplateTree", function() { model.update(); });
                ui.Template.on("enter.TemplateNest", function() { model.updateNest(); });
                ui.Template.on("update.TemplateNest", function() { model.updateNest(); });
                ui.Template.on("exit.TemplateNest", function() { model.updateNest(); });
            }
            this.setRoot = model.setRoot.bind(model);
            this.exit = function(){
                //ui.Template.on("update.TemplateTree", null );
                ui.Template.on("enter.TemplateNest", null );
                ui.Template.on("update.TemplateNest", null );
                ui.Template.on("exit.TemplateNest", null );
                layout.exit();
            }
        }
        function Layout(templateDef){
            templateDef || (templateDef = {});
            ui.Template.call(this, {factory:"Layout", module:templateDef.module});
            this.elements.menu = new ui.Node({ref:"menu"});
            this.elements.graph = new ui.Node({ref:"graph"});
            this.updateRef();
            this.ref.menu.enter.style.height = "50px";
            this.ref.graph.enter.style.height = "calc(100% - 50px)";
            this.ref.graph.enter.style.position = "relative";            
        }
        function Context(templateDef){
            templateDef || (templateDef = {});
            ui.templates.Plot.call(this, {
                factory:"Context", 
                module:templateDef.module,
                layers:{
                    tLinks:"svg",
                    tNodes:"div",
                    nLinks:"svg",
                    nNodes:"div",
                    dLinks:"svg",
                    dNodes:"div"
                }
            });
            var zoom = new ui.models.Zoom();
            ui.utils.each.call(this.ref.layers, function(item, key){
                if (item.node === "svg"){
                    item.childs.transform = new ui.Node({node:"g", ref:key});
                    item.childs.transform.enter.attr = zoom.attr;
                    item.childs.transform.update.attr = zoom.attr;
                }
                else{
                    item.childs.transform = new ui.Node({node:"div", ref:key});
                    item.childs.transform.enter.style = zoom.style;
                    item.childs.transform.update.style = zoom.style;
                    item.enter.style["overflow"] = "hidden";
                }
                item.enter.style["pointer-events"] = "none";
            })
            this.ref.layers.tLinks.enter.call = zoom.call;
            this.ref.layers.tLinks.enter.style["pointer-events"] = "auto";
            
            zoom.on("zoomed.plot", this.update);
            this.updateRef();
        }
        function Links(templateDef){
            templateDef || (templateDef = {});
            ui.Template.call(this, {
                factory:templateDef.factory || "Links", 
                module:templateDef.module
            })
            this.elements.links = new ui.Node({node:"g", ref:"links"});
            this.elements.links.childs.link = new ui.Node({node:"path", ref:"link"});
            this.updateRef();
        }
        function Nodes(templateDef){
            templateDef || (templateDef = {});
            ui.Template.call(this, {
                factory:templateDef.factory || "Nodes", 
                module:templateDef.module
            })
            this.elements.nodes = new ui.Node({node:"div", ref:"nodes"});
            this.elements.nodes.childs.node = new ui.Node({node:"div", ref:"node"});
            this.updateRef();
        }
        function Templates(templateDef){
            templateDef || (templateDef = {});
            Nodes.call(this, {
                factory:"Templates", 
                module:templateDef.module
            })
            this.ref.node.childs.factory = new ui.Node({node:"div", ref:"factory"});
            this.ref.node.childs.nest = new ui.Node({node:"div", ref:"nest.root"});
            this.ref.node.childs.nest.childs.dec = new ui.Node({node:"div", ref:"nest.dec"});
            this.ref.node.childs.nest.childs.id = new ui.Node({node:"div", ref:"nest.id"});
            this.ref.node.childs.nest.childs.inc = new ui.Node({node:"div", ref:"nest.inc"});
            this.updateRef();
            this.ref.nest.dec.enter.html = ui.symbols.utf8.arrow.left;
            this.ref.nest.dec.enter.style = {
                "pointer-events":"auto",
                "width":"10px",
                display:"inline-block",
                cursor:"pointer"
            }
            this.ref.nest.inc.enter.html = ui.symbols.utf8.arrow.right;
            this.ref.nest.inc.enter.style = {
                "pointer-events":"auto",
                "width":"10px",
                display:"inline-block",
                cursor:"pointer"
            }
            this.ref.nest.id.enter.style = {
                "width":"calc(100% - 20px)",
                display:"inline-block",
                "text-align":"center"
            }
            
        }
        function TemplateNest(){
            var self = this;
            var meta = "_nest";
            var dispatch = d3.dispatch("update");
            this.on = dispatch.on.bind(dispatch);
            var root;
            var templateHierarchyRoot;
            var templateNestRoot;
            var templateNestMeta = new ui.utils.IndexedArray({
                index:function(d){ return d.path; }
            })
            var templateNestData = new ui.utils.IndexedArray({
                index:function(d){ return d.meta.path; }
            })
             var tProp = {
                "min-width":400,
                dx:20,
                dy:30,
                k:30,
                padding:40
            };
            var nProp = {
                dx:10,
                dy:50,
                k:20,
                minW:100,
                padding:20,
                h:30
            };
            var dProp = {
                dx:5,
                k:10
            };
            var rootTemplates = [];
            var uiTemplates = {nodes:[], links:[], showLinks:false};
            var uiNodes = {nodes:[], links:[], showLinks:false};
            var uiDom = {nodes:[], links:[], showLinks:true, selectedLinks:[]};
            this.showDomLinks = function(){
                uiTemplates.showLinks = false;
                uiNodes.showLinks = false;
                uiDom.showLinks = true;
                dispatch.call("update");
            }
            this.showNodeLinks = function(){
                uiTemplates.showLinks = false;
                uiNodes.showLinks = true;
                uiDom.showLinks = false;
                dispatch.call("update");
            }
            this.showTemplateLinks = function(){
                uiTemplates.showLinks = true;
                uiNodes.showLinks = false;
                uiDom.showLinks = false;
                dispatch.call("update");
            }
            this.uiTemplates = {
                nodes:function(){ return uiTemplates.nodes },
                links:function(){ 
                    if (uiTemplates.showLinks)
                        return uiTemplates.links;
                    return [];
                },
                showLinks:function(){
                    return uiTemplates.showLinks
                }
            }
            this.uiNodes = {
                nodes:function(){ return uiNodes.nodes },
                links:function(){ 
                    if (uiNodes.showLinks)
                        return uiNodes.links;
                    return [];
                },
                showLinks:function(){
                    return uiNodes.showLinks
                }
            }
            this.uiDom = {
                nodes:function(){ return uiDom.nodes },
                links:function(){
                    if (uiDom.showLinks)
                        return uiDom.selectedLinks.length?uiDom.selectedLinks:uiDom.links;
                    return [];
                },
                showLinks:function(){
                    return uiDom.showLinks
                }
            }
            this.setRoot = setRoot;
            function setRoot(_root){
                var rootTemplate = _root;
                if (typeof rootTemplate.elements === "undefined"){
                    rootTemplate = new ui.Template();
                    rootTemplate.factory = "Root";
                    _root.key = "root";
                    rootTemplate.elements.root = _root;
                }
                root = rootTemplate;
                updateNest()
            }
            this.updateNest = updateNest;
            function updateNest(){
                uiTemplates.nodes.forEach(function(item){
                    item.values.forEach(function(item){
                        delete item.uiTemplate[meta];
                    })
                })
                uiNodes.nodes.forEach(function(item){
                    delete item.uiNode[meta];
                })
                uiDom.nodes.forEach(function(item){
                    delete item.element[meta];
                })
                templateNestData.clear();
                buildHierarchy();
                buildNest();
                update();
                templateHierarchyRoot;
                templateNestRoot;
                templateNestMeta;
                templateNestData;
            }
            function buildHierarchy(){
                templateHierarchyRoot = new TemplateHierarchyNode(root);
                procTemplate(templateHierarchyRoot);
                function procTemplate(hierarchyNode){
                    hierarchyNode.uiTemplate.elements.each(function(node){
                        procNode(hierarchyNode, node);
                    })
                }
                function procNode(hierarchyNode, node){
                    if (node instanceof ui.Array){
                        node.each(function(item){
                            procNode(hierarchyNode, item);
                        })
                        return;
                    }
                    node.childComponents &&
                    node.childComponents.each(function(template){
                        var tNode = new TemplateHierarchyNode(template);
                        hierarchyNode.childs.push(tNode);
                        procTemplate(tNode);
                    })
                    
                    node.selection.each(function(){
                        if (this.childComponents){
                            this.childComponents.each(function(template){
                                var tNode = new TemplateHierarchyNode(template);
                                hierarchyNode.childs.push(tNode);
                                procTemplate(tNode);
                            })
                        }
                    })
                    
                    node.childs &&
                    node.childs.each(function(item){
                        procNode(hierarchyNode, item);
                    })
                }
            }
            function buildNest(){
                templateNestRoot = new TemplateNestNode(undefined, {key:"Root", values:[templateHierarchyRoot]});
                var nest = d3.nest().key(function(d) {return d.uiTemplate.factory });
                procNestNode(templateNestRoot);
                function procNestNode(nestNode){
                    var nested = nest.entries(nestNode.currentNode.childs.array);
                    var childs = nested.map(function(d) { return new TemplateNestNode(nestNode, d)})
                    nestNode.childs.concat(childs);
                    nestNode.childs.array.forEach(procNestNode);
                }
            }
            function TemplateHierarchyNode(template){
                this.childs = new ui.utils.IndexedArray({
                    index:function(d) { return d.uiTemplate.id },
                    ignoreNonUnique:true
                });
                this.uiTemplate = template;
            }
            function TemplateNestNode(parent, nest){
                this.parent = parent;
                this.key = nest.key;
                this.values = nest.values;
                this.meta = {
                    path:((parent && parent.meta.path) || "")+"."+nest.key
                };
                this.childs = new ui.utils.IndexedArray({
                    index:function(d) { return d.key }
                });
                var storedMeta = templateNestMeta.get(this.meta.path);
                if (storedMeta){
                } 
                else{
                    templateNestMeta.push({path:this.meta.path, selected:0});
                }
                templateNestData.push(this);
                
				Object.defineProperty(this, "selectedIndex", {
					set:function(value){
                        var storedMeta = templateNestMeta.get(this.meta.path);
						if (storedMeta.selected == value) return;
						storedMeta.selected = value;
						if (storedMeta.selected >= this.values.length) storedMeta.selected = 0;
						if (storedMeta.selected < 0) storedMeta.selected = this.values.length - 1;
					},
                    get:function() { 
                        //return this.values[this.meta.selected] 
                        var storedMeta = templateNestMeta.get(this.meta.path);
						if (storedMeta.selected >= this.values.length) storedMeta.selected = this.values.length - 1;
						return storedMeta.selected;
                    }
				});
                Object.defineProperty(this, "currentNode", {
                    set:function(){},
                    get:function() { 
                        //return this.values[this.meta.selected] 
						var current = this.values[this.selectedIndex];
                        if (typeof current === "undefined"){
							debugger;
						}
						return current;
                    }
                })     
                this.currentNode.uiTemplate[meta] = {nestId:this.meta.path};
                if (this.currentNode.uiTemplate.factory === "Links"){
                    var a = 0;
                }
                this.nextNode = function(){
                    this.selectedIndex = this.selectedIndex + 1;
                    updateNest();
                }
                this.prevNode = function(){
                    this.selectedIndex = this.selectedIndex - 1;
                    updateNest();
                }
            }
            function update(){
                
                uiTemplates.nodes = [];
                uiTemplates.links = [];
                uiNodes.nodes = [];
                uiNodes.links = [];
                uiDom.nodes = [];
                uiDom.links = [];
                
                processTemplate(undefined, root);
                rootTemplates = uiTemplates.nodes.filter(function(d) {return typeof d.parent === "undefined" });
                uiTemplates.nodes.forEach(calcTemplateLevels);
                rootTemplates.forEach(calcTemplateSize);
                calcTemplatePos(undefined, rootTemplates);

                dispatch.call("update");			
            };
            function calcTemplateLevels(template){
                template.levels = [];
                uiTemplate = template.currentNode.uiTemplate;
                pushNodes(uiTemplate.elements);
                template.levels.forEach(function(level){
                    level.forEach(function(node){
                        node.templateChilds = node.childs.filter(function(child){
                            return child.template && child.template.currentNode.uiTemplate.id === node.template.currentNode.uiTemplate.id;
                        });
                    })
                });
                template.width = 50;
                if (template.levels[0]){
                    template.levels[0].forEach(calcNodeSize);
                    template.width = template.levels[0].reduce(function(prev, curr){ 
                        return prev + curr.size + nProp.dx;
                    }, -nProp.dx) + tProp.padding*2;
                }
                if (template.width < tProp["min-width"]) template.width = tProp["min-width"];
                var n = template.levels.length;
                template.height = n*nProp.h + (n-1)*nProp.dy + tProp.padding*2;
                function pushNodes(nodes, depth){
                    depth = depth || 0;
                    nodes.each(pushNode.bind(null, depth))
                }
                function pushNode(depth, item){
                    if (item instanceof ui.Array){
                        item.forEach(pushNode.bind(null, depth));
                        return;
                    }
                    template.levels[depth] || template.levels.push([]);
                    var id = item[meta].nodeId;
                    var node = uiNodes.nodes[id];
                    var n = item.folded.nodes().length;
                   
                    node.template = template;
                    node.width = n*dProp.k + (n - 1)*dProp.dx + nProp.padding*2;
                    node.width < nProp.minW && (node.width = nProp.minW);
                    node.height = nProp.padding + dProp.k;
                    template.levels[depth].push(node);
                    var nextDepth = depth + 1;
                    item.childs && pushNodes(item.childs, nextDepth);
                }
            }
            function calcNodeSize(node){
                node.templateChilds.forEach(calcNodeSize);
                var childSize = node.templateChilds.reduce(function(prev, curr){ 
                    return prev + curr.size + nProp.dx 
                }, -nProp.dx);
                node.size = childSize < node.width?node.width:childSize;
            }
            function calcTemplateSize(template){
                template.childs.forEach(calcTemplateSize);
                var childSize = template.childs.reduce(function(prev, curr){ 
                    return prev + curr.size + tProp.dx 
                }, -tProp.dx);
                template.size = childSize < template.width?template.width:childSize;
            }
            function calcTemplatePos(parent, templates){
                parent || (parent = { x:0, y:0, height:0 });
                var levelWidth = templates.reduce(function(prev, curr){ return prev + curr.size + tProp.dx }, -tProp.dx);
                var X = parent.x - levelWidth*0.5;
                templates.forEach(function(template) { 
                    template.y = parent.y + parent.height + tProp.dy*(parent.childs?parent.childs.length:1);
                    template.x = X + template.size*0.5;
                    if (template.levels){
                        
                    }
                    else {
                        debugger;
                    }
                    var firstLevel = template.levels[0];
                    if (firstLevel){
                        calcNodePos({x:template.x, y:template.y + tProp.padding - nProp.h - nProp.dy}, firstLevel);			
                    }	
                    calcTemplatePos(template, template.childs);
                    X += template.size + tProp.dx; 
                })
            }
            function calcNodePos(parent, nodes){
                var levelWidth = nodes.reduce(function(prev, curr){ 
                    return prev + curr.size + nProp.dx 
                }, -nProp.dx);
                var X = parent.x - levelWidth*0.5;	
                nodes.forEach(function(node) { 
                    node.y = parent.y + nProp.h + nProp.dy;
                    node.x = X + node.size*0.5;
                    calcDomPos(node);
                    calcNodePos(node, node.templateChilds);
                    X += node.size + nProp.dx; 
                })
            }
            function calcDomPos(node){
                var n = node.dom.length;
                var levelWidth = n*dProp.k + (n - 1)*dProp.dx;
                var X = node.x - levelWidth*0.5;
                node.dom.forEach(function(d, i){
                    d.y = node.y + node.height - dProp.k - 5;
                    d.x = X;
                    d.width = dProp.k;
                    d.height = dProp.k;
                    X += dProp.k + dProp.dx;
                });
            }
            function processTemplate(parentNode, template){
                if (template){
                    if (template[meta]){
                        var nest = templateNestData.get(template[meta].nestId);
                        
                        if (template.factory == "Links"){
                            var a = 1;
                        }
                        uiTemplates.nodes.push(nest);
                        nest.currentNode.uiTemplate.elements.each(function(item, key){
                            processNode(parentNode, item);
                        })
                        
                    }
                    else {
                    }
                }
                else {
                }
            }
            function processNode(parent, node){
                if (node instanceof ui.Array){
                    node.forEach(processNode.bind(null, parent));
                    return;
                }
                var nodeId = uiNodes.nodes.length;
                node[meta] = {nodeId:nodeId};
                var uiNode = {uiNode:node, childs:[], dom:[]}
                uiNodes.nodes.push(uiNode);
                if (parent && parent[meta]){
                    var sourceId = parent[meta].nodeId;
                    var targetId = node[meta].nodeId;
                    var target = uiNodes.nodes[targetId];
                    var source = uiNodes.nodes[sourceId];
                    uiNodes.links.push({source:source, target:target});
                    source.childs.push(target);
                    target.parent = source;
                }
                var selection;
                if (parent && parent.folded){
                    selection = parent.folded.selectAll(node.selector);
                }
                else {
                    selection = node.selection;
                }
                var count = 0;
                node.folded = selection.filter(function(d, i){
                    if (this.childComponents) {
                        return this;
                    }
                    if (count > 20) {
                        return null;
                        //return this;
                    }
                    count++;
                    return this;
                })
                node.folded.each(function(d, i){
                    this[meta] = {domId:uiDom.nodes.length, nodeId:nodeId};
                    var dom = {element:this, childs:[]};
                    uiNode.dom.push(dom);
                    uiDom.nodes.push(dom);
                    if (this.parentNode && this.parentNode[meta]){
                        var sourceId = this.parentNode[meta].domId;
                        var targetId = this[meta].domId;
                        var target = uiDom.nodes[targetId];
                        var source = uiDom.nodes[sourceId];
                        uiDom.links.push({source:source, target:target});
                        source.childs.push(target);
                        target.parent = source;
                        //links.push({source:target, target:target})
                    }
                })
                node.childs && 
                node.childs.each(function(item, key){
                    processNode(node, item);
                })
                node.folded.each(function(d, i){
                    var parent = this;
                    if (this === node) return;
                    this.childComponents &&
                    this.childComponents.each(function(item, key){
                        processTemplate(parent, item);
                    })
                })
                node.childComponents &&
                node.childComponents.each(function(item, key){
                    processTemplate(node, item);
                })
            }
        }
        function TemplateHierarchy(){
            var self = this;
            var meta = "_tree";
            var tProp = {
                dx:20,
                dy:30,
                k:30,
                padding:20
            };
            var nProp = {
                dx:10,
                dy:50,
                k:20,
                minW:100,
                padding:20,
                h:30
            };
            var dProp = {
                dx:5,
                k:10
            };
            var rootTemplates = [];
            var uiTemplates = {nodes:[], links:[], showLinks:false};
            var uiNodes = {nodes:[], links:[], showLinks:false};
            var uiDom = {nodes:[], links:[], showLinks:true, selectedLinks:[]};
            var nodes = [];
            var links = [];
            var root;
            var dispatch = d3.dispatch("update");
            this.nodes = function(){ return nodes };
            this.showDomLinks = function(){
                uiTemplates.showLinks = false;
                uiNodes.showLinks = false;
                uiDom.showLinks = true;
                dispatch.call("update");
            }
            this.showNodeLinks = function(){
                uiTemplates.showLinks = false;
                uiNodes.showLinks = true;
                uiDom.showLinks = false;
                dispatch.call("update");
            }
            this.showTemplateLinks = function(){
                uiTemplates.showLinks = true;
                uiNodes.showLinks = false;
                uiDom.showLinks = false;
                dispatch.call("update");
            }
            this.uiTemplates = {
                nodes:function(){ return uiTemplates.nodes },
                links:function(){ 
                    if (uiTemplates.showLinks)
                        return uiTemplates.links;
                    return [];
                },
                showLinks:function(){
                    return uiTemplates.showLinks
                }
            }
            this.uiNodes = {
                nodes:function(){ return uiNodes.nodes },
                links:function(){ 
                    if (uiNodes.showLinks)
                        return uiNodes.links;
                    return [];
                },
                showLinks:function(){
                    return uiNodes.showLinks
                }
            }
            this.uiDom = {
                nodes:function(){ return uiDom.nodes },
                links:function(){
                    if (uiDom.showLinks)
                        return uiDom.selectedLinks.length?uiDom.selectedLinks:uiDom.links;
                    return [];
                },
                showLinks:function(){
                    return uiDom.showLinks
                }
            }
            this.links = function(){ return links };
            this.on = dispatch.on.bind(dispatch);
            this.setRoot = function(_root) { 
                root = _root;
                this.update();		
            };
            this.update = function() {
                
                uiTemplates.nodes = [];
                uiTemplates.links = [];
                uiNodes.nodes = [];
                uiNodes.links = [];
                uiDom.nodes = [];
                uiDom.links = [];
                var rootTemplate = root;
                if (typeof rootTemplate.elements === "undefined"){
                    rootTemplate = new ui.Template();
                    rootTemplate.factory = "Root";
                    root.key = "root";
                    rootTemplate.elements.root = root;
                }
                processTemplate(undefined, undefined, rootTemplate);
                rootTemplates = uiTemplates.nodes.filter(function(d) {return typeof d.parent === "undefined" });
                uiTemplates.nodes.forEach(calcTemplateLevels);
                rootTemplates.forEach(calcTemplateSize);
                calcTemplatePos(undefined, rootTemplates);

                dispatch.call("update");			
            };
            function calcTemplateLevels(template){
                template.levels = [];
                uiTemplate = template.uiTemplate;
                pushNodes(uiTemplate.elements);
                template.levels.forEach(function(level){
                    level.forEach(function(node){
                        node.templateChilds = node.childs.filter(function(child){
                            return child.template && child.template.uiTemplate.id === node.template.uiTemplate.id;
                        });
                    })
                });
                template.width = 50;
                if (template.levels[0]){
                    template.levels[0].forEach(calcNodeSize);
                    template.width = template.levels[0].reduce(function(prev, curr){ 
                        return prev + curr.size + nProp.dx;
                    }, -nProp.dx) + tProp.padding*2;
                }
                var n = template.levels.length;
                template.height = n*nProp.h + (n-1)*nProp.dy + tProp.padding*2;
                function pushNodes(nodes, depth){
                    depth = depth || 0;
                    nodes.each(pushNode.bind(null, depth))
                }
                function pushNode(depth, item){
                    if (item instanceof ui.Array){
                        item.forEach(pushNode.bind(null, depth));
                        return;
                    }
                    template.levels[depth] || template.levels.push([]);
                    var id = item[meta].nodeId;
                    var node = uiNodes.nodes[id];
                    var n = item.folded.nodes().length;
                    node.template = template;
                    node.width = n*dProp.k + (n - 1)*dProp.dx + nProp.padding*2;
                    node.width < nProp.minW && (node.width = nProp.minW);
                    node.height = nProp.padding + dProp.k;
                    template.levels[depth].push(node);
                    var nextDepth = depth + 1;
                    item.childs && pushNodes(item.childs, nextDepth);
                }
            }
            function calcNodeSize(node){
                node.templateChilds.forEach(calcNodeSize);
                var childSize = node.templateChilds.reduce(function(prev, curr){ 
                    return prev + curr.size + nProp.dx 
                }, -nProp.dx);
                node.size = childSize < node.width?node.width:childSize;
            }
            function calcTemplateSize(template){
                template.childs.forEach(calcTemplateSize);
                var childSize = template.childs.reduce(function(prev, curr){ 
                    return prev + curr.size + tProp.dx 
                }, -tProp.dx);
                template.size = childSize < template.width?template.width:childSize;
            }
            function calcTemplatePos(parent, templates){
                parent || (parent = { x:0, y:0, height:0 });
                var levelWidth = templates.reduce(function(prev, curr){ return prev + curr.size + tProp.dx }, -tProp.dx);
                var X = parent.x - levelWidth*0.5;
                templates.forEach(function(template) { 
                    template.y = parent.y + parent.height + tProp.dy*(parent.childs?parent.childs.length:1);
                    template.x = X + template.size*0.5;
                    var firstLevel = template.levels[0];
                    if (firstLevel){
                        calcNodePos({x:template.x, y:template.y + tProp.padding - nProp.h - nProp.dy}, firstLevel);			
                    }	
                    calcTemplatePos(template, template.childs);
                    X += template.size + tProp.dx; 
                })
            }
            function calcNodePos(parent, nodes){
                var levelWidth = nodes.reduce(function(prev, curr){ 
                    return prev + curr.size + nProp.dx 
                }, -nProp.dx);
                var X = parent.x - levelWidth*0.5;	
                nodes.forEach(function(node) { 
                    node.y = parent.y + nProp.h + nProp.dy;
                    node.x = X + node.size*0.5;
                    calcDomPos(node);
                    calcNodePos(node, node.templateChilds);
                    X += node.size + nProp.dx; 
                })
            }
            function calcDomPos(node){
                var n = node.dom.length;
                var levelWidth = n*dProp.k + (n - 1)*dProp.dx;
                var X = node.x - levelWidth*0.5;
                node.dom.forEach(function(d, i){
                    d.y = node.y + node.height - dProp.k - 5;
                    d.x = X;
                    d.width = dProp.k;
                    d.height = dProp.k;
                    X += dProp.k + dProp.dx;
                });
            }
            function processTemplate(parentTemplate, parentNode, template){
                var templateId = uiTemplates.nodes.length;
                template[meta] = {templateId:templateId};
                uiTemplates.nodes.push({uiTemplate:template, childs:[]});
                if (parentTemplate && parentTemplate[meta]){
                    var sourceId = parentTemplate[meta].templateId;
                    var targetId = template[meta].templateId;
                    var target = uiTemplates.nodes[targetId];
                    var source = uiTemplates.nodes[sourceId];
                    uiTemplates.links.push({source:source, target:target});
                    source.childs.push(target);
                    target.parent = source;
                }
                template.elements.each(function(item, key){
                    processNode(template, parentNode, item);
                })
            }
            function processNode(template, parent, node){
                if (node instanceof ui.Array){
                    node.forEach(processNode.bind(null, template, parent));
                    return;
                }
                var nodeId = uiNodes.nodes.length;
                node[meta] = {nodeId:nodeId};
                var uiNode = {uiNode:node, childs:[], dom:[]}
                uiNodes.nodes.push(uiNode);
                if (parent && parent[meta]){
                    var sourceId = parent[meta].nodeId;
                    var targetId = node[meta].nodeId;
                    var target = uiNodes.nodes[targetId];
                    var source = uiNodes.nodes[sourceId];
                    uiNodes.links.push({source:source, target:target});
                    source.childs.push(target);
                    target.parent = source;
                }
                var selection;
                if (parent && parent.folded){
                    selection = parent.folded.selectAll(node.selector);
                }
                else {
                    selection = node.selection;
                }
                var count = 0;
                node.folded = selection.filter(function(d, i){
                    if (this.childComponents) {
                        return this;
                    }
                    if (count > 20) {
                        return null;
                        //return this;
                    }
                    count++;
                    return this;
                })
                node.folded.each(function(d, i){
                    this[meta] = {domId:uiDom.nodes.length, nodeId:nodeId};
                    var dom = {element:this, childs:[]};
                    uiNode.dom.push(dom);
                    uiDom.nodes.push(dom);
                    if (this.parentNode && this.parentNode[meta]){
                        var sourceId = this.parentNode[meta].domId;
                        var targetId = this[meta].domId;
                        var target = uiDom.nodes[targetId];
                        var source = uiDom.nodes[sourceId];
                        uiDom.links.push({source:source, target:target});
                        source.childs.push(target);
                        target.parent = source;
                        //links.push({source:target, target:target})
                    }
                })
                node.childs && 
                node.childs.each(function(item, key){
                    processNode(template, node, item);
                })
                node.folded.each(function(d, i){
                    var parent = this;
                    if (this === node) return;
                    this.childComponents &&
                    this.childComponents.each(function(item, key){
                        processTemplate(template, parent, item);
                    })
                })
                node.childComponents &&
                node.childComponents.each(function(item, key){
                    processTemplate(template, node, item);
                })
            }
        }
    }
    function uiUtils(){
        this.extend = extend;
        this.each = each;
        this.concater = concater;
        this.savers = new Savers;
        function extend(obj){
            var self = this;
            ui.utils.each.call(obj, function(value, key){
                self[key] = value;
            })
            return this;
        }
        function each(func, recursive){
            var constName = this.constructor.name;
            for (var i in this){
                if(!this.hasOwnProperty(i)) continue;
                var nodeName = this[i].constructor.name;
                if (recursive && nodeName == constName)
                    each.call(this[i], func, recursive);
                else
                    func.call(this, this[i], i);
            }
        }
        function concater(separator){
			separator = separator || "";
			return function(prev, curr){ return prev + separator + curr };
		}
        this.IndexedArray = IndexedArray;
        function IndexedArray(config){
            config = config || {};
            this.index = config.index;
            this.ignoreNonUnique = config.ignoreNonUnique?true:false;
            this.map = d3.map();
            this.array = [];
            Object.defineProperty(this, "length", {
                get:function(){ return this.array.length},
                set:function() {}
            })
        };
        IndexedArray.prototype.forEach = function(callback){
            this.array.forEach(callback);
        }
        IndexedArray.prototype.reduce = function(){
            return this.array.reduce.apply(this.array, arguments);
        }
        IndexedArray.prototype.clear = function(){
            this.map = d3.map();
            this.array = [];
        }
        IndexedArray.prototype.get = function(id){
            var i = this.map.get(id);
            return this.array[i];
        };
        IndexedArray.prototype.push = function(value){
            if (this.map.has(this.index(value)) && this.ignoreNonUnique) return;
            if (this.map.has(this.index(value))) 
                throw new Error("non unique index");
            this.map.set(this.index(value), this.array.length);
            this.array.push(value);
        };
        IndexedArray.prototype.concat = function(tail){
            for (var i = 0; i < tail.length; i++){
                this.map.set(this.index(tail[i]), this.array.length + i);
            }
            this.array = this.array.concat(tail);
        };
        function Savers(){
            this.csv = csv;
            this.json = json;
            this.clipboard = clipboard;
            function csv(config){
                config || (config = {})
                var filename = config.filename || "export.csv";
                var separator = config.separator || "\t";
                var head = config.head || [];
                var body = config.body || [];
                var data = [head].concat(body);
                var txt = data.reduce(function(prev, curr){ return prev + curr.reduce(concater(separator)) + "\n"}, "");
                var blob = new Blob([txt], {type:"text/csv;charset=utf-8"});
                saveAs(blob, filename);
            }
            function json(config){
                config || (config = {})
                var filename = config.filename || "export.json";
                var data = config.data || {};
                var txt = JSON.stringify(data, null, 4);
                var blob = new Blob([txt], {type:"text/json;charset=utf-8"});
                saveAs(blob, filename);
            }
            function clipboard(text){
                var temp = new ui.templates.BasicTemplate({
                    elements:{
                        text:"textarea"
                    }
                })
                temp.ref.text.enter.property.value = text;
                temp.enter(document.body);
                temp.ref.text.selection.node().select();
                document.execCommand("copy");
                temp.exit();
            }
        }
    }
    function uiSymbols(){
        this.utf8 = {};
        this.utf8.arrow = {};
        this.utf8.arrow.right = "&#x25BA";
        this.utf8.arrow.left = "&#x25C4";
        this.utf8.arrow.down = "&#x25BC";
    }
    
	function patchD3(d3){
        d3.selection.prototype.apply = apply;
		d3.selection.prototype.applyAll = applyAll;
		d3.transition.prototype.apply = apply;
		d3.transition.prototype.applyAll = applyAll;
        d3.dispatch.prototype.addEvent = addEvent;
        function addEvent(name){
            this["_"][name] = [];            
        }
        function apply(func, struct){
            var context = this;
            if (func !== "attr" && func !== "property" && func !== "on" && func !== "classed" && func !== "style"){
                if (typeof context[func] === "function"){
                    if (struct instanceof Array){ 
                        var n = struct.length;
                        for (var i = 0; i < n; i++){
                            context = context.apply(func, struct[i]);
                        }
                    }
                    else {
                        context = context[func](struct);
                    }
                }
            }
            else if (typeof struct === "function"){
                var transition;
                if (context.constructor.name === "Gn")
                    transition = context;
                context.each(function (d, i, arr){
                    var selection = d3.select(this);
                    if (transition) selection = selection.transition(transition)
                    selection.apply(func, struct.call(this, d, i, arr));
                })
            }
            else if (struct instanceof Array){ 
                var n = struct.length;
                for (var i = 0; i < n; i++){
                    context.apply(func, struct[i]);
                }
            }
            else{ 
                for (var key in struct){
                    context = context[func](key, struct[key]);
                }   
            }
            return context;
        }
        function applyAll(struct){
            var context = this;
            if (typeof struct === "function"){
                var transition;
                if (this.constructor.name === "Gn")
                    transition = context;
                context.each(function (d, i, arr){
                    var selection = d3.select(this);
                    if (transition) selection = selection.transition(transition)
                    selection.applyAll(struct.call(this, d, i, arr));
                })
            }
            else if (struct instanceof Array){ 
                var n = struct.length;
                for (var i = 0; i < n; i++){
                    context = context.applyAll(struct[i]);
                }
            }
            else{
                if (typeof struct === "undefined") return context;
                if (struct.call) context.apply("call", struct.call);
                if (struct.html) context.apply("html", struct.html);
                for (var func in struct){
                    if (!struct.hasOwnProperty(func)) continue;
                    if (func !== "call" && func !== "html"){
                        context = context.apply(func, struct[func])
                    }
                }
            }
            return context;
        }
    }
    return ui;
});